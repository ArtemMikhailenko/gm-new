import { useState, useEffect, useCallback } from "react";
import { init, useSetChain, useWallets } from "@web3-onboard/react";
import torusModule from "@web3-onboard/torus";

import injectedModule from "@web3-onboard/injected-wallets";
import metamaskSDK from "@web3-onboard/metamask";
import phantomModule from "@web3-onboard/phantom";
import walletConnectModule from "@web3-onboard/walletconnect";
// Add Coinbase Wallet import
import coinbaseWalletModule from "@web3-onboard/coinbase";
import { AmbireWalletModule } from "@ambire/login-sdk-web3-onboard";
import { AmbireLoginSDK } from "@ambire/login-sdk-core";
import { CHAINS, WALLETCONNECT_PROJECT_ID } from "@/src/config";
import { ethers } from "ethers";
import { Chain, OnboardAPI, WalletState } from "@web3-onboard/core";
import {
  CONTRACT_ADDRESS,
  CONTRACT_ABI,
  API_URL,
  CURRENT_CHAIN,
} from "@/src/config";
import { showNetworkSwitchModal } from "@/src/utils/networkModal";

export const useWeb3 = () => {
  const [web3Onboard, setWeb3Onboard] = useState<OnboardAPI | null>(null);
  const [connectedWallet, setConnectedWallet] = useState<WalletState | null>(
    null
  );
  const [connectedChain, setConnectedChain] = useState<Chain | null>(null);
  const torus = torusModule();

  useEffect(() => {
    if (!web3Onboard) return;

    const walletsSub = web3Onboard.state
      .select("wallets")
      .subscribe((wallets: any) => {
        console.log("walletsSub", wallets.length, wallets);
        if (wallets && wallets.length > 0) {
          setConnectedWallet(wallets[0]);
          if (wallets[0].chains && wallets[0].chains.length > 0) {
            setConnectedChain(wallets[0].chains[0]);
          }
        } else {
          setConnectedWallet(null);
          setConnectedChain(null);
        }
      });

    return () => {
      walletsSub.unsubscribe();
    };
  }, [web3Onboard]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const ambireWallet = AmbireWalletModule({
      dappName: "GM",
      dappIconPath:
        "https://pbs.twimg.com/profile_images/1834344421984256000/AcWFYzUl_400x400.jpg",
    });

    const metamaskSDKWallet = metamaskSDK({
      options: {
        extensionOnly: false,
        dappMetadata: {
          name: "GM",
        },
      },
    });

    // Initialize WalletConnect
    const walletConnect = walletConnectModule({
      projectId: WALLETCONNECT_PROJECT_ID || "YOUR_PROJECT_ID",
      requiredChains: [CURRENT_CHAIN.id],
      dappUrl: window.location.origin,
    });

    // Initialize Coinbase Wallet with the correct properties
    const coinbaseWallet = coinbaseWalletModule({
      darkMode: false,
      enableMobileWalletLink: true,
      reloadOnDisconnect: false,
    });

    const phantom = phantomModule();
    const injected = injectedModule();

    const onboard = init({
      // Add coinbaseWallet to the wallets array
      wallets: [
        injected,
        metamaskSDKWallet,
        phantom,
        torus,
        walletConnect,
        coinbaseWallet,
        // ambireWallet,
      ],
      connect: {
        showSidebar: true,
        autoConnectLastWallet: true,
      },
      chains: [
        {
          id: CURRENT_CHAIN.hexId,
          token: CURRENT_CHAIN.token,
          label: CURRENT_CHAIN.label,
          rpcUrl: CURRENT_CHAIN.rpcUrl,
        },
      ],
      appMetadata: {
        name: "GM",
        icon: "/image/wallet/sun-with-cup.webp",
        description: "GM ☀️ first tweet&mint coin",
        recommendedInjectedWallets: [
          { name: "MetaMask", url: "https://metamask.io" },
          { name: "Coinbase", url: "https://wallet.coinbase.com/" },
        ],
        gettingStartedGuide: "getting started guide",
      },
      accountCenter: {
        desktop: {
          enabled: true,
        },
      },
    });

    setWeb3Onboard(onboard);
  }, []);
  const getProvider = useCallback(() => {
    if (!connectedWallet?.provider) {
      // console.error("No wallet connected");
      return null;
    }

    try {
      // Check if wallet is connected to the correct network
      if (
        connectedChain &&
        parseInt(connectedChain.id, 16) !== CURRENT_CHAIN.id
      ) {
        console.warn(
          `Wallet connected to wrong network: ${connectedChain.id}, expected: ${CURRENT_CHAIN.hexId}`
        );
      }

      // For Ambire wallet use modified provider
      if (connectedWallet.label === "Ambire") {
        console.log("Creating modified provider for Ambire");

        // Create standard BrowserProvider
        const baseProvider = new ethers.BrowserProvider(
          connectedWallet.provider,
          "any"
        );

        // Intercept calls to methods that may not be supported by Ambire
        const ambireProvider = {
          ...baseProvider,

          // Override getBalance method
          getBalance: async (address: string) => {
            try {
              // First try standard method
              return await baseProvider.getBalance(address);
            } catch (error) {
              console.log(
                "Error calling getBalance, using alternative method",
                error
              );

              // In case of error use API to get balance
              try {
                const response = await fetch(
                  `https://base-sepolia.blockscout.com/api/v2/addresses/${address}`
                );
                if (response.ok) {
                  const data = await response.json();
                  if (data && data.coin_balance) {
                    return ethers.parseEther(data.coin_balance);
                  }
                }
              } catch (apiError) {
                console.error("Error querying API blockscout:", apiError);
              }

              // If all methods fail, return zero balance
              console.warn("Failed to get balance, returning 0");
              return BigInt(0);
            }
          },

          // Add getSigner method for compatibility
          getSigner: async () => {
            return await baseProvider.getSigner();
          },

          // Add getFeeData method for compatibility
          getFeeData: async () => {
            try {
              return await baseProvider.getFeeData();
            } catch (error) {
              console.error("Error calling getFeeData:", error);
              // Return default values if the method fails
              return {
                gasPrice: BigInt(10000000000), // 10 gwei default
                maxFeePerGas: null,
                maxPriorityFeePerGas: null,
              };
            }
          },

          // Need to override call method
          call: async (transaction: any) => {
            try {
              return await baseProvider.call(transaction);
            } catch (error: any) {
              console.error("Error calling call:", error);

              // Check if error is related to eth_ methods
              if (error.message) {
                // Handle eth_getBalance errors
                if (error.message.includes("eth_getBalance")) {
                  console.warn(
                    "Problem with eth_getBalance, returning zero result"
                  );
                  return "0x0";
                }

                // Handle "could not coalesce error" or code 4200 errors (unsupported methods)
                if (
                  error.message.includes("could not coalesce error") ||
                  error.message.includes("Provider does not support") ||
                  (error.code && error.code === 4200)
                ) {
                  console.warn(
                    "Provider does not support requested method, returning default value"
                  );

                  // For call transactions that might be requesting balance
                  if (
                    transaction &&
                    (transaction.data === "0x70a08231" ||
                      (transaction.data &&
                        transaction.data.startsWith("0x70a08231")))
                  ) {
                    console.log(
                      "Balance request detected, returning empty balance"
                    );
                    return "0x0";
                  }

                  // For other method calls return empty result
                  return "0x";
                }
              }

              throw error; // Propagate other errors
            }
          },
        };

        // Add network event handler
        baseProvider.on(
          "network",
          (
            newNetwork: { chainId: number },
            oldNetwork: { chainId: number } | null
          ) => {
            if (oldNetwork && newNetwork.chainId !== oldNetwork.chainId) {
              console.log(
                `Network changed from ${oldNetwork.chainId} to ${newNetwork.chainId}`
              );

              // If network changed to incorrect, show warning
              if (newNetwork.chainId !== CURRENT_CHAIN.id) {
                console.warn(
                  `Network changed to incorrect network: ${newNetwork.chainId}, expected: ${CURRENT_CHAIN.id}`
                );
              }
            }
          }
        );

        return ambireProvider;
      }

      // Use BrowserProvider instead of Web3Provider for non-Ambire wallets
      const provider = new ethers.BrowserProvider(
        connectedWallet.provider,
        "any"
      );

      // Add network error handler
      provider.on(
        "network",
        (
          newNetwork: { chainId: number },
          oldNetwork: { chainId: number } | null
        ) => {
          if (oldNetwork && newNetwork.chainId !== oldNetwork.chainId) {
            console.log(
              `Network changed from ${oldNetwork.chainId} to ${newNetwork.chainId}`
            );

            // If network changed to incorrect, show warning
            if (newNetwork.chainId !== CURRENT_CHAIN.id) {
              console.warn(
                `Network changed to incorrect network: ${newNetwork.chainId}, expected: ${CURRENT_CHAIN.id}`
              );
            }
          }
        }
      );

      return provider;
    } catch (error) {
      console.error("Error getting provider:", error);
      return null;
    }
  }, [connectedWallet, connectedChain]);

  const getSigner = async () => {
    const provider = getProvider();
    return await provider?.getSigner();
  };
  const connect = async () => {
    if (!web3Onboard) return;

    try {
      // Connect wallet
      const wallets = await web3Onboard.connectWallet();
      console.log("wallets", wallets.length, wallets);

      if (wallets.length > 0) {
        setConnectedWallet(wallets[0]);

        // Use new function for network switching
        await handleSwitchNetwork(wallets[0]);

        // Set network change listener
        web3Onboard.state.select("chains").subscribe((chains: Chain[]) => {
          console.log("chains sub", chains.length, chains);
          if (chains && chains.length > 0) {
            const newChain = chains[0];
            setConnectedChain(newChain);

            // Check if new network matches required
            const newChainId = parseInt(newChain.id, 16);
            if (newChainId !== CURRENT_CHAIN.id) {
              console.warn(
                `⚠️ Connected to incorrect network: ${newChain.label} (${newChainId}), required: ${CURRENT_CHAIN.label} (${CURRENT_CHAIN.id})`
              );
            } else {
              console.log(
                `✅ Connected to correct network: ${newChain.label} (${newChainId})`
              );
            }
          }
        });
      }
    } catch (error) {
      console.error("Error connecting wallet:", error);
    }
  };
  const createAmbireWallet = async () => {
    try {
      const ambireLoginSDK = new AmbireLoginSDK({
        dappName: "GM",
        dappIconPath:
          "/image/wallet/sun-with-cup.webp",
        network: CURRENT_CHAIN.id,
      });

      ambireLoginSDK.onLoginSuccess(
        async (data: {
          address: string;
          chainId: number;
          providerUrl: string;
        }) => {
          console.log("Ambire login success:", data);
          console.log(
            `Current chainId: ${data.chainId}, Required chainId: ${CURRENT_CHAIN.id}`
          );

          if (web3Onboard) {
            try {
              const wallets = await web3Onboard.connectWallet();

              if (wallets.length > 0) {
                let attempts = 0;
                const maxAttempts = 3;

                const attemptNetworkSwitch = async () => {
                  attempts++;
                  console.log(
                    `Attempt ${attempts} to switch network for Ambire wallet`
                  );

                  try {
                    const provider = new ethers.BrowserProvider(
                      wallets[0].provider
                    );
                    const network = await provider.getNetwork();
                    const currentChainId = Number(network.chainId);

                    console.log(
                      `Current chain ID: ${currentChainId}, Required: ${CURRENT_CHAIN.id}`
                    );

                    if (currentChainId !== CURRENT_CHAIN.id) {
                      const success = await handleSwitchNetwork(wallets[0]);

                      if (!success && attempts < maxAttempts) {
                        const delay = 2000 * attempts;
                        console.log(
                          `Network switch attempt failed, trying again in ${delay}ms`
                        );
                        setTimeout(attemptNetworkSwitch, delay);
                      } else if (!success) {
                        console.log(
                          "Maximum attempts reached. Showing network switch modal."
                        );
                        showNetworkSwitchModal(wallets[0]);
                      }
                    } else {
                      console.log("Already on correct network!");
                    }
                  } catch (error) {
                    console.error("Error checking/switching network:", error);
                    if (attempts < maxAttempts) {
                      const delay = 2000 * attempts;
                      setTimeout(attemptNetworkSwitch, delay);
                    } else {
                      showNetworkSwitchModal(wallets[0]);
                    }
                  }
                };

                setTimeout(attemptNetworkSwitch, 1500);
              }
            } catch (error) {
              console.error(
                "Error connecting wallet after Ambire login:",
                error
              );
            }
          }
        }
      );

      ambireLoginSDK.onRegistrationSuccess(
        (data: { address: string; chainId: number; providerUrl: string }) => {
          console.log("Ambire registration success:", data);
          if (web3Onboard) {
            web3Onboard.connectWallet();
          }
        }
      );

      ambireLoginSDK.onAlreadyLoggedIn(
        async (data: {
          address: string;
          chainId: number;
          providerUrl: string;
        }) => {
          console.log("Ambire already logged in:", data);

          if (data.chainId !== CURRENT_CHAIN.id) {
            console.log(
              "Already logged in but on wrong network. Attempting to switch..."
            );

            if (web3Onboard) {
              try {
                const wallets = await web3Onboard.connectWallet();
                if (wallets.length > 0) {
                  setTimeout(async () => {
                    await handleSwitchNetwork(wallets[0]);
                  }, 1500);
                }
              } catch (error) {
                console.error("Error handling already logged in state:", error);
              }
            }
          } else {
            console.log("Already logged in and on correct network!");
            if (web3Onboard) {
              web3Onboard.connectWallet();
            }
          }
        }
      );

      ambireLoginSDK.onLogoutSuccess(() => {
        console.log("Ambire logout success");
        if (
          web3Onboard &&
          connectedWallet &&
          connectedWallet.label === "Ambire"
        ) {
          web3Onboard.disconnectWallet(connectedWallet);
        }
      });

      ambireLoginSDK.openLogin({ chainId: CURRENT_CHAIN.id });
      console.log(
        `Ambire Wallet login modal opened with chainId: ${CURRENT_CHAIN.id}!`
      );

      return ambireLoginSDK;
    } catch (error) {
      console.error("Error creating Ambire Wallet:", error);
      return null;
    }
  };
  const disconnect = async () => {
    if (!web3Onboard || !connectedWallet) {
      console.log("No wallet or onboard to disconnect");
      return;
    }

    try {
      console.log("Starting wallet disconnection process");

      // Remove provider, instance, icon, accounts, chains and wagmiConnector fields
      const {
        icon,
        instance,
        provider,
        accounts,
        chains,
        wagmiConnector,
        ...walletForDisconnect
      } = connectedWallet as any;

      // Additional handling for Ambire wallet
      if (walletForDisconnect.label === "Ambire") {
        try {
          const ambireLoginSDK = new AmbireLoginSDK({
            dappName: "GM",
            dappIconPath: "/image/wallet/sun-with-cup.webp",
          });
          ambireLoginSDK.openLogout();
        } catch (ambireError) {
          console.error(
            "Error with Ambire logout, continuing with standard disconnect:",
            ambireError
          );
        }
      }

      // Clear UI state
      setConnectedWallet(null);
      setConnectedChain(null);

      // Perform disconnection in Web3Onboard
      try {
        await web3Onboard.disconnectWallet(walletForDisconnect);
        console.log(
          `Wallet ${walletForDisconnect.label} disconnected successfully`
        );
      } catch (disconnectError) {
        console.error("Error during wallet disconnection:", disconnectError);
      }
    } catch (error) {
      console.error("Error in disconnect function:", error);
      setConnectedWallet(null);
      setConnectedChain(null);
    }
  };

  // Replace function for explicit network switching
  const handleSwitchNetwork = async (wallet: WalletState): Promise<boolean> => {
    try {
      if (wallet.label === "Ambire") {
        console.log("Using Ambire-specific network switching method");
        const provider = new ethers.BrowserProvider(wallet.provider);

        try {
          const network = await provider.getNetwork();
          console.log(
            `Current network for Ambire: ${network.chainId} (${Number(
              network.chainId
            )})`
          );

          if (Number(network.chainId) === CURRENT_CHAIN.id) {
            console.log("Already on correct network!");
            return true;
          }
        } catch (error) {
          console.error("Error checking current network:", error);
        }

        // Try direct window.ethereum method first for Ambire
        try {
          if (window.ethereum) {
            console.log("Attempting direct window.ethereum method for Ambire");
            await window.ethereum.request({
              method: "wallet_switchEthereumChain",
              params: [{ chainId: CURRENT_CHAIN.hexId }],
            });

            // Verify the switch worked
            const network = await provider.getNetwork();
            if (Number(network.chainId) === CURRENT_CHAIN.id) {
              console.log(
                "✅ Successfully switched network using window.ethereum"
              );
              return true;
            }
          }
        } catch (directError) {
          console.log("Direct window.ethereum method failed:", directError);
        }

        // Continue with regular provider method if direct method failed
        try {
          await provider.send("wallet_switchEthereumChain", [
            { chainId: CURRENT_CHAIN.hexId },
          ]);

          console.log("Verifying network switch...");
          const network = await provider.getNetwork();

          if (Number(network.chainId) === CURRENT_CHAIN.id) {
            console.log("✅ Successfully switched to required network");
            return true;
          } else {
            console.log(
              `❌ Network switch verification failed. Current: ${Number(
                network.chainId
              )}, Expected: ${CURRENT_CHAIN.id}`
            );
            showNetworkSwitchModal(wallet);
            return false;
          }
        } catch (switchError: any) {
          console.error("Error switching network for Ambire:", switchError);

          try {
            // Try adding the network first
            await provider.send("wallet_addEthereumChain", [
              {
                chainId: CURRENT_CHAIN.hexId,
                chainName: CURRENT_CHAIN.label,
                nativeCurrency: {
                  name: "ETH",
                  symbol: "ETH",
                  decimals: 18,
                },
                rpcUrls: [CURRENT_CHAIN.rpcUrl],
                blockExplorerUrls: [CURRENT_CHAIN.blockExplorerUrl],
              },
            ]);

            // Then try switching again
            await provider.send("wallet_switchEthereumChain", [
              { chainId: CURRENT_CHAIN.hexId },
            ]);

            const newNetwork = await provider.getNetwork();
            const success = Number(newNetwork.chainId) === CURRENT_CHAIN.id;

            if (!success) {
              // If still failed, show manual switch modal
              showNetworkSwitchModal(wallet);
            }

            return success;
          } catch (addError) {
            console.error("Failed to add network:", addError);
            // Show manual switch modal as last resort
            showNetworkSwitchModal(wallet);
            return false;
          }
        }
      }

      const provider = new ethers.BrowserProvider(wallet.provider);

      try {
        await provider.send("wallet_switchEthereumChain", [
          { chainId: CURRENT_CHAIN.hexId },
        ]);
        console.log("✅ Successfully switched to Base network");
        return true;
      } catch (switchError: any) {
        if (
          switchError.code === 4902 ||
          switchError.message.includes("Unrecognized chain")
        ) {
          try {
            await provider.send("wallet_addEthereumChain", [
              {
                chainId: CURRENT_CHAIN.hexId,
                chainName: CURRENT_CHAIN.label,
                nativeCurrency: {
                  name: "ETH",
                  symbol: "ETH",
                  decimals: 18,
                },
                rpcUrls: [CURRENT_CHAIN.rpcUrl],
                blockExplorerUrls: [CURRENT_CHAIN.blockExplorerUrl],
              },
            ]);

            await provider.send("wallet_switchEthereumChain", [
              { chainId: CURRENT_CHAIN.hexId },
            ]);

            console.log("✅ Network added and switched successfully");
            return true;
          } catch (addError) {
            console.error("Failed to add network:", addError);
            showNetworkSwitchModal(wallet);
            return false;
          }
        }

        console.error("Failed to switch network:", switchError);
        showNetworkSwitchModal(wallet);
        return false;
      }
    } catch (error) {
      console.error("Error in handleSwitchNetwork:", error);
      showNetworkSwitchModal(wallet);
      return false;
    }
  };

  // Function to update network state in UI
  const updateNetworkState = (chainId: string) => {
    if (web3Onboard) {
      web3Onboard.state.select("chains").subscribe((chains: Chain[]) => {
        const targetChain = chains.find((chain) => chain.id === chainId);
        if (targetChain) {
          setConnectedChain(targetChain);
        }
      });
    }
  };

  return {
    disconnect,
    web3Onboard,
    connectedWallet,
    connectedChain,
    connect,
    createAmbireWallet,
    getProvider,
    getSigner,
    handleSwitchNetwork,
    switchToBase,
  };
};

export async function switchToBase() {
  console.log("switchToBase function started");
  const baseChainId = CURRENT_CHAIN.hexId;

  const windowEthereum = window.ethereum;
  if (!windowEthereum) {
    console.error("window.ethereum is not available");
    throw new Error("window.ethereum is not available");
  }

  try {
    // Check the current chain ID
    const currentChainId = await windowEthereum.request({
      method: "eth_chainId",
    });
    console.log(`Current chain ID: ${currentChainId}, Target: ${baseChainId}`);

    if (currentChainId !== baseChainId) {
      console.log("Attempting to switch chain using window.ethereum.request");
      // Add delay for Ambire
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Attempt to switch to Base network
      await windowEthereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: baseChainId }],
      });

      console.log("Switch request sent successfully");

      // Additional verification after switching
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const newChainId = await windowEthereum.request({
        method: "eth_chainId",
      });

      if (newChainId === baseChainId) {
        console.log(
          `✅ Successfully switched to ${CURRENT_CHAIN.label} network`
        );
        return true;
      } else {
        console.warn(
          `⚠️ Chain ID didn't change: current=${newChainId}, expected=${baseChainId}`
        );
        // If switch failed, try to add the network
        throw { code: 4902, message: "Chain not switched, trying to add" };
      }
    } else {
      console.log(`Already on ${CURRENT_CHAIN.label} network`);
      return true;
    }
  } catch (switchError: any) {
    console.error("Error in switchToBase:", switchError);

    // If Base isn't added, add it first
    if (
      switchError.code === 4902 ||
      switchError.message?.includes("Unrecognized chain") ||
      switchError.message?.includes("Chain not switched")
    ) {
      console.log("Chain not recognized, attempting to add it");

      try {
        // Add delay before adding network
        await new Promise((resolve) => setTimeout(resolve, 500));

        await windowEthereum.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: baseChainId,
              chainName: CURRENT_CHAIN.label,
              nativeCurrency: {
                name: CURRENT_CHAIN.token || "ETH",
                symbol: CURRENT_CHAIN.token || "ETH",
                decimals: 18,
              },
              rpcUrls: [CURRENT_CHAIN.rpcUrl],
              blockExplorerUrls: [CURRENT_CHAIN.blockExplorerUrl],
            },
          ],
        });

        console.log("Network add request sent");

        // Short pause before switching
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // After adding, switch to Base
        await windowEthereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: baseChainId }],
        });

        // Final verification
        const finalChainId = await windowEthereum.request({
          method: "eth_chainId",
        });

        if (finalChainId === baseChainId) {
          console.log(
            `✅ ${CURRENT_CHAIN.label} network added and switched successfully`
          );
          return true;
        } else {
          console.warn(
            `⚠️ Final chain check failed: current=${finalChainId}, expected=${baseChainId}`
          );
          throw new Error("Failed to switch after adding network");
        }
      } catch (addError: any) {
        console.error(
          `Failed to add ${CURRENT_CHAIN.label} network:`,
          addError
        );
        throw addError;
      }
    } else {
      console.error(
        `Failed to switch to ${CURRENT_CHAIN.label} network:`,
        switchError
      );
      throw switchError;
    }
  }
}
