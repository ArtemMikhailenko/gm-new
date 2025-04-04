export const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "";
export const TWITTER_CLIENT_ID =
  process.env.NEXT_PUBLIC_TWITTER_CLIENT_ID || "";
export const WALLETCONNECT_PROJECT_ID =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "";
export const CONTRACT_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function name() view returns (string)",
  "function requestTwitterVerification(string accessCodeEncrypted, string userID)",
  "function requestTwitterVerificationByTweet(string authCode)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "event TwitterVerificationResult(string userID, address wallet, bool isSuccess, string errorMsg)",
] as const;
export const API_URL = process.env.NEXT_PUBLIC_API_URL || "";
export const TOKEN_URL = process.env.NEXT_PUBLIC_TOKEN_URL || "";

// Network configuration
export const NETWORK = process.env.NEXT_PUBLIC_NETWORK;

// Chain configurations
export const CHAIN_CONFIGS = {
  testnet: {
    id: 84532,
    hexId: "0x14a34",
    token: "ETH",
    label: "Base Sepolia",
    rpcUrl: "https://sepolia.base.org",
    wsRpcUrl: "wss://sepolia.base.org/ws",
    blockExplorerUrl: "https://sepolia.basescan.org",
  },
  mainnet: {
    id: 8453,
    hexId: "0x2105",
    token: "ETH",
    label: "Base",
    rpcUrl: "https://mainnet.base.org",
    wsRpcUrl: "wss://mainnet.base.org/ws",
    blockExplorerUrl: "https://basescan.org",
  },
};

// Get current chain config based on environment
export const CURRENT_CHAIN =
  CHAIN_CONFIGS[NETWORK as keyof typeof CHAIN_CONFIGS];

// For compatibility with existing code
export const CHAINS = [
  {
    id: CURRENT_CHAIN?.id,
    token: CURRENT_CHAIN?.token,
    label: CURRENT_CHAIN?.label,
    rpcUrl: CURRENT_CHAIN?.rpcUrl,
  },
];