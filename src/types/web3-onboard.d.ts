// types/web3-onboard.d.ts

declare module '@web3-onboard/core' {
    export interface Chain {
      id: string;
      token: string;
      label: string;
      rpcUrl: string;
    }
  
    export interface WalletState {
      label: string;
      icon?: string;
      provider?: any;
      accounts?: Array<{
        address: string;
        balance: {
          asset: string;
          value: string;
        };
      }>;
      chains?: Chain[];
      instance?: {
        [key: string]: any;
      };
    }
  
    export interface InitOptions {
      wallets: Array<any>;
      chains: Chain[];
      appMetadata?: {
        name: string;
        icon: string;
        description: string;
        recommendedInjectedWallets?: Array<{
          name: string;
          url: string;
        }>;
        gettingStartedGuide?: string;
      };
      connect?: {
        showSidebar?: boolean;
        autoConnectLastWallet?: boolean;
      };
      accountCenter?: {
        desktop?: {
          enabled?: boolean;
        };
      };
    }
  
    export interface OnboardAPI {
      connectWallet(): Promise<WalletState[]>;
      disconnectWallet(wallet: WalletState): void;
      setChain(options: { chainId: string }): Promise<boolean>;
      state: {
        select: (key: string) => {
          subscribe: (callback: (val: any) => void) => {
            unsubscribe: () => void;
          };
        };
      };
    }
  
    export default function init(options: InitOptions): OnboardAPI;
  }
  
  declare module '@web3-onboard/injected-wallets' {
    const injectedModule: () => any;
    export default injectedModule;
  }
  
  declare module '@web3-onboard/metamask' {
    interface MetaMaskOptions {
      options?: {
        extensionOnly?: boolean;
        dappMetadata?: {
          name: string;
        };
      };
    }
    const metamaskSDK: (options?: MetaMaskOptions) => any;
    export default metamaskSDK;
  }
  
  declare module '@web3-onboard/phantom' {
    const phantomModule: () => any;
    export default phantomModule;
  }
  
  declare module '@ambire/login-sdk-web3-onboard' {
    interface AmbireOptions {
      dappName: string;
      dappIconPath?: string;
    }
    export const AmbireWalletModule: (options: AmbireOptions) => any;
  }
  