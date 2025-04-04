import React, { useState, useEffect } from "react";
import styles from "./TwitterVerify.module.css";
import ButtonBackground from "../../../components/ui/buttons/BlueButton";
import { useWeb3 } from "@/src/hooks/useWeb3";
import { ethers } from "ethers";
import { CONTRACT_ADDRESS, CONTRACT_ABI } from "@/src/config";
import Modal from "../../../components/modals/Modal";

// Array of tweet templates
const TWEET_TEMPLATES = [
  "GM to everyone! I'm verifying my wallet with GMCoin {authCode} 🚀",
  "Just getting verified with GMCoin! {authCode} ☀️ GM world!",
  "GM! Getting my wallet verified with {authCode} on GMCoin",
  "Spreading GM vibes with GMCoin! Verification code: {authCode}",
  "GM GMCoin community! Verifying my wallet with {authCode}"
];

interface TwitterVerifyProps {
  onConnectClick: () => Promise<void>;
  isConnecting: boolean;
  walletAddress: string;
  onVerificationSuccess: () => void;
}

const TwitterVerify: React.FC<TwitterVerifyProps> = ({
  onConnectClick,
  isConnecting,
  walletAddress,
  onVerificationSuccess
}) => {
  const [verificationMethod, setVerificationMethod] = useState<"tweet" | "oauth">("tweet");
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [authCode, setAuthCode] = useState("");
  const [showTweetModal, setShowTweetModal] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<"idle" | "pending" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [tweetText, setTweetText] = useState("");
  const { getSigner } = useWeb3();

  // Generate auth code when component mounts or wallet address changes
  useEffect(() => {
    if (walletAddress) {
      generateAuthCode(walletAddress);
    }
  }, [walletAddress]);

  // Handle mouse movement for animation
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth) * 20 - 10;
      const y = (e.clientY / window.innerHeight) * 20 - 10;
      setMousePosition({ x, y });
    };
    
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  // Generate a unique auth code for the user
  const generateAuthCode = (address: string) => {
    if (!address) return;
    
    // Get first 5 characters of wallet address (without 0x)
    const walletFirst5 = address.slice(2, 7).toUpperCase();
    
    // Generate 5 random letters and numbers
    const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let random5 = "";
    for (let i = 0; i < 5; i++) {
      random5 += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    
    // Create the auth code in the format GM + walletFirst5 + random5 + GM
    const code = `GM${walletFirst5}${random5}GM`;
    setAuthCode(code);
    
    // Select a random tweet template and insert the auth code
    const randomTemplate = TWEET_TEMPLATES[Math.floor(Math.random() * TWEET_TEMPLATES.length)];
    setTweetText(randomTemplate.replace("{authCode}", code));
  };

  // Open Twitter intent to tweet
  const openTweetIntent = () => {
    const encodedText = encodeURIComponent(tweetText);
    const twitterIntentUrl = `https://twitter.com/intent/tweet?text=${encodedText}`;
    window.open(twitterIntentUrl, "_blank");
  };

  // Verify tweet by calling smart contract
  const verifyTweet = async () => {
    if (!authCode || !walletAddress) {
      setErrorMessage("Missing auth code or wallet address");
      setVerificationStatus("error");
      return;
    }

    setVerificationStatus("pending");
    
    try {
      const signer = await getSigner();
      
      if (!signer) {
        throw new Error("Failed to get signer");
      }
      
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      
      // Call the requestTwitterVerificationByTweet function
      const tx = await contract.requestTwitterVerificationByTweet(authCode);
      console.log("Transaction hash:", tx.hash);
      
      // Set up event listener for TwitterVerificationResult
      const filter = contract.filters.TwitterVerificationResult();
      
      // Create a promise that will resolve when the event is received or timeout
      const verificationPromise = new Promise((resolve, reject) => {
        // Set timeout for 1 minute
        const timeout = setTimeout(() => {
          reject(new Error("Verification timed out after 1 minute"));
        }, 60000);
        
        // Listen for the event
        contract.on(filter, (userID, wallet, isSuccess, errorMsg) => {
          // Check if this event is for our wallet
          if (wallet.toLowerCase() === walletAddress.toLowerCase()) {
            clearTimeout(timeout);
            
            if (isSuccess) {
              resolve("Verification successful");
            } else {
              reject(new Error(errorMsg || "Verification failed"));
            }
            
            // Remove the event listener
            contract.removeAllListeners(filter);
          }
        });
      });
      
      // Wait for the verification result
      await verificationPromise;
      
      // Mark verification as successful
      setVerificationStatus("success");
      localStorage.setItem("hasCompletedTwitterVerification", "true");
      localStorage.setItem("userAuthenticated", "true");
      
      // Call the success callback
      onVerificationSuccess();
      
    } catch (error: any) {
      console.error("Verification error:", error);
      setErrorMessage(error.message || "An error occurred during verification");
      setVerificationStatus("error");
    }
  };

  // Handle switching between verification methods
  const switchVerificationMethod = (method: "tweet" | "oauth") => {
    setVerificationMethod(method);
    setVerificationStatus("idle");
    setErrorMessage("");
  };

  return (
    <div className={styles.container}>
      {/* Background elements with parallax effect */}
      <div
        className={styles.waveContainer}
        style={{
          transform: `translate(${mousePosition.x * 0.2}px, ${
            mousePosition.y * 0.2
          }px)`,
        }}
      >
        <img src="/image/xcloude.webp" alt="" className={styles.waveImage} />
      </div>
      <div
        className={styles.planeContainer}
        style={{
          transform: `translate(${mousePosition.x}px, ${mousePosition.y}px)`,
        }}
      >
        <img src="/image/planepng.webp" alt="" className={styles.planeImage} />
      </div>
      <div
        className={styles.cloudContainer}
        style={{
          transform: `translate(${mousePosition.x * -0.3}px, ${
            mousePosition.y * -0.3
          }px)`,
        }}
      >
        <img src="/image/whcloude.webp" alt="" className={styles.cloudImage} />
      </div>
      <div
        className={styles.birdContainer}
        style={{
          transform: `translate(${mousePosition.x * -0.5}px, ${
            mousePosition.y * -0.5
          }px)`,
        }}
      >
        <img src="/image/birds.png" alt="" className={styles.birdImage} />
      </div>

      {/* Main content */}
      <span className={styles.title}>CONNECT YOUR TWITTER</span>
      
      {/* Verification method tabs */}
      <div className={styles.tabsContainer}>
        <button 
          className={`${styles.tabButton} ${verificationMethod === "tweet" ? styles.activeTab : ""}`}
          onClick={() => switchVerificationMethod("tweet")}
        >
          Tweet to Verify
        </button>
        <button 
          className={`${styles.tabButton} ${verificationMethod === "oauth" ? styles.activeTab : ""}`}
          onClick={() => switchVerificationMethod("oauth")}
        >
          Connect with X
        </button>
      </div>

      {/* Tweet verification */}
      {verificationMethod === "tweet" && (
        <div className={styles.verificationContainer}>
          <p className={styles.verificationInfo}>
            Create a tweet with your verification code to link your X account
          </p>
          
          <div className={styles.codeBox}>
            <span className={styles.codeLabel}>Your verification code:</span>
            <span className={styles.codeValue}>{authCode}</span>
          </div>
          
          <div className={styles.buttonContainer}>
            <button
              onClick={() => setShowTweetModal(true)}
              className={styles.button}
              disabled={verificationStatus === "pending"}
            >
              <ButtonBackground />
              <span className={styles.buttonText}>
                TWEET TO VERIFY
              </span>
            </button>
          </div>
          
          {verificationStatus === "error" && (
            <div className={styles.errorMessage}>
              {errorMessage}
            </div>
          )}
        </div>
      )}

      {/* OAuth verification */}
      {verificationMethod === "oauth" && (
        <div className={styles.buttonContainer}>
          <button
            onClick={onConnectClick}
            disabled={isConnecting}
            className={`${styles.button} ${
              isConnecting ? styles.buttonDisabled : ""
            }`}
          >
            <ButtonBackground />
            <span className={styles.buttonText}>
              {isConnecting ? "CONNECTING..." : "CONNECT WITH X"}
            </span>
            {isConnecting && <div className={styles.buttonSpinner} />}
          </button>
        </div>
      )}

      {/* Tweet modal */}
      {showTweetModal && (
        <Modal
          onClose={() => {
            if (verificationStatus !== "pending") {
              setShowTweetModal(false);
            }
          }}
          variant={
            verificationStatus === "success" 
              ? "success" 
              : verificationStatus === "error" 
                ? "error" 
                : "default"
          }
        >
          <div className={styles.modalContent}>
            <h3 className={styles.modalTitle}>
              {verificationStatus === "pending" 
                ? "Verifying Your Tweet" 
                : verificationStatus === "success"
                  ? "Verification Successful!"
                  : verificationStatus === "error"
                    ? "Verification Failed"
                    : "Tweet to Verify"}
            </h3>
            
            {verificationStatus === "idle" && (
              <>
                <p className={styles.modalText}>
                  Click the button below to send a tweet with your verification code. Once you've tweeted, come back and click "Verify My Tweet".
                </p>
                
                <div className={styles.tweetPreview}>
                  <p>{tweetText}</p>
                </div>
                
                <div className={styles.modalActions}>
                  <button 
                    className={`${styles.modalButton} ${styles.tweetButton}`}
                    onClick={openTweetIntent}
                  >
                    POST ON X
                  </button>
                  
                  <button 
                    className={styles.modalButton}
                    onClick={verifyTweet}
                  >
                    I'VE TWEETED, VERIFY ME
                  </button>
                </div>
              </>
            )}
            
            {verificationStatus === "pending" && (
              <div className={styles.loadingContainer}>
                <div className={styles.loader}></div>
                <p className={styles.loadingText}>
                  Checking your tweet and verifying your account...
                </p>
                <p className={styles.loadingSubtext}>
                  This may take up to a minute. Please don't close this window.
                </p>
              </div>
            )}
            
            {verificationStatus === "success" && (
              <div className={styles.successContainer}>
                <div className={styles.successIcon}>✓</div>
                <p className={styles.successText}>
                  Your Twitter account has been successfully verified!
                </p>
                <button 
                  className={styles.modalButton}
                  onClick={onVerificationSuccess}
                >
                  CONTINUE
                </button>
              </div>
            )}
            
            {verificationStatus === "error" && (
              <div className={styles.errorContainer}>
                <div className={styles.errorIcon}>!</div>
                <p className={styles.errorText}>
                  {errorMessage}
                </p>
                <div className={styles.modalActions}>
                  <button 
                    className={styles.modalButton}
                    onClick={() => {
                      setVerificationStatus("idle");
                      setErrorMessage("");
                    }}
                  >
                    TRY AGAIN
                  </button>
                  <button 
                    className={`${styles.modalButton} ${styles.alternateButton}`}
                    onClick={() => {
                      setShowTweetModal(false);
                      switchVerificationMethod("oauth");
                    }}
                  >
                    TRY OAUTH INSTEAD
                  </button>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};

export default TwitterVerify;