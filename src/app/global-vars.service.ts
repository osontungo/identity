import { Injectable } from '@angular/core';
import { environment } from '../environments/environment';
import { AccessLevel, Network } from '../types/identity';

@Injectable({
  providedIn: 'root',
})
export class GlobalVarsService {
  constructor() {}

  get environment(): { [k: string]: any } {
    return environment;
  }
  static fullAccessHostnames = environment.fullAccessHostnames;
  static noAccessHostnames = environment.noAccessHostnames;

  static DEFAULT_NANOS_PER_USD_EXCHANGE_RATE = 1e9;
  static NANOS_PER_UNIT = 1e9;
  static WEI_PER_ETH = 1e18;

  network = Network.mainnet;
  hostname = '';
  accessLevelRequest = AccessLevel.ApproveAll;

  inTab = !!window.opener;
  webview = false;
  hideGoogle = false;
  jumio = false;
  signedUp = false;
  getFreeDeso = false;

  // Set 'derive' url param to true to return a derived key when logging in or signing up
  derive = false;

  // Derived key callback URL href / debug info
  callback = '';
  callbackInvalid = false;

  jumioUSDCents = 0;
  referralUSDCents = 0;
  captchaDeSoNanos = 0;

  referralHashBase58 = '';

  messagingGroupNameMaxLength = 32;
  defaultMessageKeyName = 'default-key';
  claimJwtDerivedPublicKey = 'derivedPublicKeyBase58Check';

  nanosPerUSDExchangeRate = 0;
  nanosToDeSoMemo = {};
  blockHeight = 0;

  derivedPublicKey = '';
  transactionSpendingLimitResponse = '';
  deleteKey = false;
  expirationDays = 0;

  redirectURI = '';

  /**
   * If true, the "Skip" button will be shown on the get deso page.
   */
  showSkip: boolean = false;

  /**
   * Flag used to gate the new subAccounts functionality. After some sunset
   * period (TBD), we can remove this flag and make this the default behavior.
   */
  subAccounts: boolean = false;

  /**
   * Set of public keys that have been authenticated by the calling application.
   * This is used as a hint to decide whether to show the derived key approval
   * UI or not after the user selects an account to login with. If the account
   * they select is provided in this set, then we skip the approval UI and issue
   * a plain login payload.
   */
  authenticatedUsers: Set<string> = new Set();

  isFullAccessHostname(): boolean {
    return GlobalVarsService.fullAccessHostnames.includes(this.hostname);
  }

  inFrame(): boolean {
    try {
      return window.self !== window.top;
    } catch (e) {
      // Most browsers block access to window.top when in an iframe
      return true;
    }
  }

  showJumio(): boolean {
    return environment.jumioSupported && !this.webview && this.jumio;
  }

  nanosToDeSo(nanos: number, maximumFractionDigits: number = 2): string {
    if (!maximumFractionDigits && nanos > 0) {
      // maximumFractionDigits defaults to 3.
      // Set it higher only if we have very small amounts.
      maximumFractionDigits = Math.floor(10 - Math.log10(nanos));
    }

    // Always show at least 2 digits
    if (maximumFractionDigits < 2) {
      maximumFractionDigits = 2;
    }

    // Never show more than 9 digits
    if (maximumFractionDigits > 9) {
      maximumFractionDigits = 9;
    }

    // Always show at least 2 digits
    const minimumFractionDigits = 2;
    const num = nanos / 1e9;
    return Number(num).toLocaleString('en-US', {
      style: 'decimal',
      currency: 'USD',
      minimumFractionDigits,
      maximumFractionDigits,
    });
  }

  nanosToUSDNumber(nanos: number): number {
    return nanos / this.nanosPerUSDExchangeRate;
  }

  nanosToUSD(nanos: number, decimal?: number | null): string {
    if (decimal == null) {
      decimal = 4;
    }
    return this.formatUSD(this.nanosToUSDNumber(nanos), decimal);
  }

  formatUSD(num: number, decimal: number): string {
    return Number(num).toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: decimal,
      maximumFractionDigits: decimal,
    });
  }

  showMetamask(): boolean {
    return this.network === Network.testnet || this.blockHeight > 166066;
  }

  isMobile(): boolean {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );
  }

  getFreeDESOMessage(): string {
    return this.formatUSD(
      (this.referralUSDCents ? this.referralUSDCents : this.jumioUSDCents) /
        100,
      0
    );
  }

  ObjectKeyLength(obj: { [k: string]: any } | undefined): number {
    return obj ? Object.keys(obj).length : 0;
  }

  cleanSpendingLimitOperationName(opName: string): string {
    return opName
      .split('_')
      .map((token) =>
        token.toLocaleLowerCase() === 'nft'
          ? 'NFT'
          : token.charAt(0).toUpperCase() + token.slice(1).toLowerCase()
      )
      .join(' ');
  }

  // If the count is 1 billion or more, it will be displayed as "UNLIMITED"
  // Otherwise, it will be displayed as a delimited number based on the user's locale.
  formatTxCountLimit(count: number = 0): string {
    return count >= 1e9 ? 'UNLIMITED' : count.toLocaleString();
  }
}
