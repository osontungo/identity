import { Injectable } from '@angular/core';
import { WindowPostMessageStream } from '@metamask/post-message-stream';
import { initializeProvider } from '@metamask/providers';
import { EthereumProvider } from '@walletconnect/ethereum-provider';
import { ec } from 'elliptic';
import { ethers } from 'ethers';
import { GlobalVarsService } from './global-vars.service';

@Injectable({
  providedIn: 'root',
})
export class MetamaskService {
  walletProvider: WalletProvider;
  constructor(private globalVars: GlobalVarsService) {
    if (!(window as any).ethereum && navigator.userAgent.includes('Firefox')) {
      // setup background connection
      const metamaskStream = new WindowPostMessageStream({
        name: 'metamask-inpage',
        target: 'metamask-contentscript',
      }) as any;

      // this will initialize the provider and set it as window.ethereum
      initializeProvider({
        connectionStream: metamaskStream,
        shouldShimWeb3: true,
      });
    }

    this.walletProvider = new WalletProvider(globalVars);
  }

  public connectWallet(): Promise<void> {
    return this.walletProvider.connectWallet();
  }

  public connectMetamaskMiddleware(): Promise<boolean> {
    return this.walletProvider.connectMetamaskMiddleware();
  }

  /**
   *
   * @param accessBytesHex determines what the derived key will be able to do for the user
   * @returns message: a byte array representation of the public key, expiration block for the derived key, and spending limits
   * @returns signature: the signed message by the derivedKeyPair object
   * generates a spending limits message and signature for authorizing a derived key
   */
  public async signMessageWithMetamaskAndGetEthAddress(
    accessBytesHex: string
  ): Promise<{
    message: number[];
    signature: string;
    publicEthAddress: string;
  }> {
    try {
      await this.connectMetamaskMiddleware();
    } catch (e) {
      throw e;
    }

    // Access Bytes Encoding 2.0
    const message = [...Buffer.from(accessBytesHex, 'hex')];
    return new Promise<{
      message: number[];
      signature: string;
      publicEthAddress: string;
    }>((resolve, reject) => {
      this.walletProvider
        .signMessage(message)
        .then(async (signature) => {
          try {
            const publicEthAddress =
              await this.verifySignatureAndRecoverAddress(message, signature);
            resolve({ message, signature, publicEthAddress });
          } catch (e) {
            reject(`signature error: ${e}`);
          }
        })
        .catch((err) => {
          reject(err);
        });
    });
  }

  public async verifySignatureAndRecoverAddress(
    message: number[],
    signature: string
  ): Promise<string> {
    try {
      await this.connectMetamaskMiddleware();
    } catch (e) {
      throw e;
    }

    const arrayify = ethers.utils.arrayify;
    const hash = ethers.utils.hashMessage;
    const recoveredAddress = ethers.utils.recoverAddress(
      arrayify(hash(message)),
      signature
    );
    const publicEthAddress = await this.walletProvider.getUserEthAddress();
    if (recoveredAddress.toUpperCase() !== publicEthAddress.toUpperCase()) {
      throw new Error(
        "Public key recovered from signature doesn't match the signer's public key!"
      );
    }
    return recoveredAddress;
  }
  public getUserEthAddress(): Promise<string> {
    return this.walletProvider.getUserEthAddress();
  }
  /**
   * Event listener for when a user switches their connected account
   * @param addressToDisplay address in template to update when the signer changes
   */
  public onSignerChange(callback: (updatedAccount: string) => void): void {
    if (this.globalVars.isMobile()) {
      return;
    }
    (window as any).ethereum.on(
      'accountsChanged',
      function (accounts: string[]) {
        callback(accounts[0]);
      }
    );
  }

  /**
   *
   * @param signature a signature from the metamask account that we can extract the public key from
   * @param message the raw message that's included in the signature, needed to pull out the public key
   * @returns
   * extracts the public key from a signature and then encodes it to base58 aka a deso public key
   */
  public getMetaMaskMasterPublicKeyFromSignature(
    signature: string,
    message: number[]
  ): ec.KeyPair {
    const e = new ec('secp256k1');
    const arrayify = ethers.utils.arrayify;
    const messageHash = arrayify(ethers.utils.hashMessage(message));
    const publicKeyUncompressedHexWith0x = ethers.utils.recoverPublicKey(
      messageHash,
      signature
    );
    const metamaskPublicKey = e.keyFromPublic(
      publicKeyUncompressedHexWith0x.slice(2),
      'hex'
    );
    return metamaskPublicKey;
  }
}

export class WalletProvider {
  #ethereumProvider: ethers.providers.Web3Provider | null = null;
  #metamaskDeepLink?: string;

  get isConnected() {
    return !!this.#ethereumProvider;
  }

  get ethereumProvider() {
    if (!this.#ethereumProvider) {
      throw new Error(
        'Ethereum provider not initialized. Did you forget to call connectWallet()?'
      );
    }
    return this.#ethereumProvider;
  }

  constructor(private globalVars: GlobalVarsService) {
    const ethereum = (window as any).ethereum;
    if (ethereum) {
      this.#ethereumProvider = new ethers.providers.Web3Provider(ethereum);
    }
  }

  async connectWallet(): Promise<void> {
    if (!this.#ethereumProvider && this.globalVars.isMobile()) {
      // See: https://docs.walletconnect.com/2.0/web/providers/ethereum
      const provider = await EthereumProvider.init({
        projectId: 'bea679efaf1bb0481c4974e65c510200',
        chains: [1 /* Mainnet */],
        optionalChains: [5 /* Goerli */],
        optionalMethods: ['eth_requestAccounts'],
        metadata: {
          description:
            'DeSo Identity: The official wallet provider supported by the DeSo Foundation',
          url: 'https://identity.desovn.online',
          icons: ['https://cryptologos.cc/logos/deso-deso-logo.svg'],
          name: 'DeSo Identity',
        },
        // NOTE: We can bypass the wallet connect QR modal by opening the
        // metamask deep link provided by the display_uri event. See
        // `provider.on('display_uri', ...) below.
        showQrModal: true,
        qrModalOptions: {
          explorerRecommendedWalletIds: [
            'c57ca95b47569778a828d19178114f4db188b89b763c899ba0be274e97267d96',
          ],
          explorerExcludedWalletIds: 'ALL',
        },
      });

      // provider.on('display_uri', (uri) => {
      //   // We keep the metamask deep link so we can open it later for signing.
      //   this.#metamaskDeepLink = uri;
      //   openDeepLink(uri);
      // });

      // Opens the metamask mobile app and requests the user to connect their wallet.
      await provider.connect();

      // Wrap the wallet connect provider in ethersjs so we can use the same API
      // to interact with the metamask wallet for both mobile and desktop.
      this.#ethereumProvider = new ethers.providers.Web3Provider(provider);
    }

    const accounts = await this.listAccounts();
    if (accounts.length === 0) {
      await this.connectMetamaskMiddleware();
    } else if (!this.globalVars.isMobile()) {
      // NOTE: wallet_requestPermissions is not currently supported on the metamask mobile app
      // https://docs.metamask.io/wallet/reference/rpc-api/#wallet_requestpermissions
      await this.ethereumProvider
        .send('wallet_requestPermissions', [
          {
            eth_accounts: {},
          },
        ])
        .catch((err) => {
          if (err.code === 4001) {
            throw new Error('user rejected the eth_requestPermissions');
          } else {
            throw new Error(
              `error while sending eth_requestPermissions: ${err}`
            );
          }
        });
    }
  }

  async connectMetamaskMiddleware(): Promise<boolean> {
    const accounts = await this.listAccounts();
    if (accounts.length === 0) {
      await this.ethereumProvider
        .send('eth_requestAccounts', [])
        .then()
        .catch((err) => {
          // EIP-1193 userRejectedRequest error.
          if (err.code === 4001) {
            throw new Error('user rejected the eth_requestAccounts request');
          } else {
            throw new Error(`error while sending eth_requestAccounts: ${err}`);
          }
        });
    }
    return true;
  }

  listAccounts(): Promise<string[]> {
    return this.ethereumProvider.listAccounts();
  }

  signMessage(message: number[]): Promise<string> {
    const pendingSignature = this.ethereumProvider
      .getSigner()
      .signMessage(message);

    // NOTE: We need to manually open the metamask app on mobile so the user can
    // sign the message. Desktop uses the metamask extension which is triggered
    // automatically by the signMessage() call. Once the user signs the message the
    // pendingSignature promise will resolve and the flow will proceed.
    if (this.#metamaskDeepLink) {
      openDeepLink(this.#metamaskDeepLink);
    }

    return pendingSignature;
  }

  getUserEthAddress(): Promise<string> {
    return this.ethereumProvider.getSigner().getAddress();
  }
}

function openDeepLink(deepLink: string) {
  window.open(deepLink, '_self', 'noopener,noreferrer');
}
