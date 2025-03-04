import { Component, OnInit } from '@angular/core';
import { setupInteractionEventListener } from 'src/app/interaction-event-helpers';
import { AccessLevel, Network } from '../types/identity';
import { AccountService } from './account.service';
import { getStateParamsFromGoogle } from './auth/google/google.component';
import { BackendAPIService } from './backend-api.service';
import { GlobalVarsService } from './global-vars.service';
import { IdentityService } from './identity.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit {
  title = 'identity';

  loading = true;

  constructor(
    private accountService: AccountService,
    private globalVars: GlobalVarsService,
    private identityService: IdentityService,
    private backendApiService: BackendAPIService
  ) {
    setupInteractionEventListener();
  }

  ngOnInit(): void {
    // load params
    const params = new URLSearchParams(window.location.search);

    // grab hash parameters from window and not activatedRoute because init is run before detecting fragment
    let hashParams;
    if (window.location.hash && window.location.hash.length > 1) {
      // hash includes the hashtag symbol so use substring to remove it
      hashParams = new URLSearchParams(window.location.hash.substring(1));
    }

    const accessLevelRequest = params.get('accessLevelRequest');
    if (accessLevelRequest) {
      this.globalVars.accessLevelRequest = parseInt(accessLevelRequest, 10);
    }

    const stateParamsFromGoogle = getStateParamsFromGoogle(hashParams);
    if (params.get('webview') || stateParamsFromGoogle.webview) {
      this.globalVars.webview = true;
    }

    if (params.get('testnet') || stateParamsFromGoogle.testnet) {
      this.globalVars.network = Network.testnet;
    }

    if (params.get('hideGoogle')) {
      this.globalVars.hideGoogle = true;
    }

    if (params.get('signedUp') === 'true' || stateParamsFromGoogle.signedUp) {
      this.globalVars.signedUp = params.get('signedUp') === 'true';
    }

    if (
      params.get('getFreeDeso') === 'true' ||
      stateParamsFromGoogle.getFreeDeso
    ) {
      this.globalVars.getFreeDeso = true;
    }

    const authenticatedUsers = new Set(
      params.get('authenticatedUsers')?.split(',') ?? []
    );
    if (authenticatedUsers.size > 0) {
      this.globalVars.authenticatedUsers = authenticatedUsers;
    }

    if (params.get('subAccounts') === 'true') {
      this.globalVars.subAccounts = true;
    }

    // Callback should only be used in mobile applications, where payload is passed through URL parameters.
    const callback = params.get('callback') || stateParamsFromGoogle.callback;
    if (callback) {
      try {
        const callbackURL = new URL(callback as string);
        this.globalVars.callback = callbackURL.href;
      } catch (err) {
        this.globalVars.callbackInvalid = true;
        console.error(err);
      }
    }

    this.globalVars.redirectURI =
      params.get('redirect_uri') ?? stateParamsFromGoogle.redirect_uri ?? '';

    const showSkip = params.get('showSkip');
    this.globalVars.showSkip =
      (showSkip && JSON.parse(showSkip)) ??
      stateParamsFromGoogle.showSkip ??
      false;

    if (params.get('derive') === 'true' || stateParamsFromGoogle.derive) {
      this.globalVars.derive = true;
    }

    const transactionSpendingLimitResponse =
      params.get('transactionSpendingLimitResponse') ||
      stateParamsFromGoogle.transactionSpendingLimitResponse;
    if (transactionSpendingLimitResponse) {
      this.globalVars.transactionSpendingLimitResponse =
        transactionSpendingLimitResponse;
    }

    const derivedPublicKey =
      params.get('derivedPublicKey') || stateParamsFromGoogle.derivedPublicKey;
    if (derivedPublicKey) {
      this.globalVars.derivedPublicKey = derivedPublicKey;
    }

    const deleteKey =
      params.get('deleteKey') === 'true' || stateParamsFromGoogle.deleteKey;
    if (deleteKey) {
      this.globalVars.deleteKey = true;
    }

    const expirationDays =
      parseInt(params.get('expirationDays') || '0', 10) ||
      stateParamsFromGoogle.expirationDays;
    if (expirationDays) {
      this.globalVars.expirationDays = expirationDays;
    }

    const referralCodeKey = 'referralCode';
    let referralCode = params.get(referralCodeKey);
    // Request may fail if browser doesn't support local storage e.g. incognito, third party cookies blocked, etc
    try {
      if (!referralCode) {
        referralCode = localStorage.getItem(referralCodeKey);
      }
      if (referralCode) {
        localStorage.setItem(referralCodeKey, referralCode);
        this.globalVars.referralHashBase58 = referralCode;
        this.backendApiService
          .GetReferralInfoForReferralHash(referralCode)
          .subscribe((res) => {
            const referralInfo = res.ReferralInfoResponse.Info;
            const countrySignUpBonus = res.CountrySignUpBonus;
            if (!countrySignUpBonus.AllowCustomReferralAmount) {
              this.globalVars.referralUSDCents =
                countrySignUpBonus.ReferralAmountOverrideUSDCents;
            } else if (
              res.ReferralInfoResponse.IsActive &&
              (referralInfo.TotalReferrals < referralInfo.MaxReferrals ||
                referralInfo.MaxReferrals === 0)
            ) {
              this.globalVars.referralUSDCents =
                referralInfo.RefereeAmountUSDCents;
            } else {
              this.globalVars.referralUSDCents =
                countrySignUpBonus.ReferralAmountOverrideUSDCents;
            }
          });
      }
    } catch (e) {
      console.error(e);
    }

    if (this.globalVars.callback || this.globalVars.redirectURI) {
      if (this.globalVars.callback) {
        this.globalVars.hostname = 'localhost';
      }
      this.finishInit();
    } else if (
      this.globalVars.webview ||
      this.globalVars.inTab ||
      this.globalVars.inFrame()
    ) {
      // We must be running in a webview OR opened with window.open OR in an iframe to initialize
      this.identityService.initialize().subscribe((res) => {
        this.globalVars.hostname = res.hostname;
        if (this.globalVars.isFullAccessHostname()) {
          this.globalVars.accessLevelRequest = AccessLevel.Full;
        }

        this.finishInit();
      });
    } else {
      // Identity currently doesn't have any management UIs that can be accessed directly
      window.location.href = `https://deso.org`;
    }

    this.backendApiService.GetAppState().subscribe((res) => {
      this.globalVars.jumioUSDCents = res.JumioUSDCents;
      this.globalVars.nanosPerUSDExchangeRate =
        1e9 / (res.USDCentsPerDeSoExchangeRate / 100);
      this.globalVars.blockHeight = res.BlockHeight;
      this.globalVars.captchaDeSoNanos = res.CaptchaDeSoNanos;
    });
  }

  finishInit(): void {
    // Attempt to migrate all accounts. This can fail if the browser is not supported
    try {
      this.accountService.migrate();
    } catch (e) {
      console.error(e);
    }

    // Finish loading
    this.loading = false;
  }
}
