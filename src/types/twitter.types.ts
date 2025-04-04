export interface TwitterAuthState {
  isAuthorized: boolean;
  isConnected: boolean;
  isLoading: boolean;
  twitterName: string;
  userId: string | null;
}

export interface TwitterVerificationProps {
  onSuccess: () => void;
  onError: (error: string) => void;
}

export interface TwitterConnectProps {
  onConnectClick: () => Promise<void>;
  isConnecting: boolean;
}

export interface TwitterVerifyProps {
  onConnectClick: () => Promise<void>;
  isConnecting: boolean;
  walletAddress: string;
  onVerificationSuccess: () => void;
}