// TwitterConnect.tsx - Simplified and more visually appealing
"use client";

import React, { useEffect, useState } from "react";
import type { TwitterConnectProps } from "@/src/types";
import styles from "./TwitterConnect.module.css";
import cloude from "@/public/image/xcloude.webp";
import plane from "@/public/image/planepng.webp";
import whcloude from "@/public/image/whcloude.webp";
import bird from "@/public/image/birds.png";
import ButtonBackground from "../../ui/buttons/BlueButton";
import Modal from "../../modals/Modal";
import { ethers } from "ethers";
import { CONTRACT_ADDRESS, CONTRACT_ABI } from "@/src/config";

// Tweet templates array
const TWEET_TEMPLATES = [
  "GM to everyone! I'm verifying my wallet with GMCoin {authCode} 🚀",
  "Just getting verified with GMCoin! {authCode} ☀️ GM world!",
  "GM! Getting my wallet verified with {authCode} on GMCoin",
  "Spreading GM vibes with GMCoin! Verification code: {authCode}",
  "GM GMCoin community! Verifying my wallet with {authCode}"
];

const TwitterConnect: React.FC<TwitterConnectProps> = ({
  onConnectClick,
  isConnecting,
}) => {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [verificationMethod, setVerificationMethod] = useState<"tweet" | "oauth">("tweet");
  const [authCode, setAuthCode] = useState("");
  const [tweetText, setTweetText] = useState("");
  const [showTweetModal, setShowTweetModal] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<"idle" | "pending" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [errorDetails, setErrorDetails] = useState("");

  // Parallax effect
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth) * 20 - 10;
      const y = (e.clientY / window.innerHeight) * 20 - 10;
      setMousePosition({ x, y });
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  // Generate auth code on component mount
  useEffect(() => {
    const walletAddress = localStorage.getItem("walletAddress");
    if (walletAddress) {
      generateAuthCode(walletAddress);
    }
  }, []);

  const generateAuthCode = (walletAddress: string) => {
    // Get first 5 chars from wallet address (without "0x")
    const walletFirst5 = walletAddress.slice(2, 7).toUpperCase();
    const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let random5 = "";
    for (let i = 0; i < 5; i++) {
      random5 += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    const code = `GM${walletFirst5}${random5}GM`;
    setAuthCode(code);

    // Select random tweet template and insert auth code
    const randomTemplate = TWEET_TEMPLATES[Math.floor(Math.random() * TWEET_TEMPLATES.length)];
    setTweetText(randomTemplate.replace("{authCode}", code));
  };

  // Open X/Twitter intent window
  const openTweetIntent = () => {
    const encodedText = encodeURIComponent(tweetText);
    const twitterIntentUrl = `https://twitter.com/intent/tweet?text=${encodedText}`;
    window.open(twitterIntentUrl, "_blank");
  };

  // Verify tweet via smart contract
  const verifyTweet = async () => {
    console.log("verifyTweet clicked");

    if (!authCode) {
      setErrorMessage("Missing verification code");
      setErrorDetails("Please refresh and try again");
      setVerificationStatus("error");
      return;
    }
    
    setVerificationStatus("pending");

    try {
      if (!window.ethereum) {
        throw new Error("Ethereum provider not found");
      }
      
      const provider = new ethers.BrowserProvider(window.ethereum!);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

      // Request verification
      const tx = await contract.requestTwitterVerificationByTweet(authCode);
      console.log("Transaction hash:", tx.hash);

      // Listen for verification result event
      const filter = contract.filters.TwitterVerificationResult();
      const verificationPromise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Verification timed out after 1 minute"));
        }, 60000);

        contract.on(filter, (userID, wallet, isSuccess, errorMsg) => {
          // Check if event is for our wallet
          const storedWallet = localStorage.getItem("walletAddress");
          if (storedWallet && wallet.toLowerCase() === storedWallet.toLowerCase()) {
            clearTimeout(timeout);
            if (isSuccess) {
              resolve("Verification successful");
            } else {
              reject(new Error(errorMsg || "Verification failed"));
            }
            contract.removeAllListeners(filter);
          }
        });
      });

      await verificationPromise;
      setVerificationStatus("success");
      localStorage.setItem("hasCompletedTwitterVerification", "true");
      localStorage.setItem("userAuthenticated", "true");

      // Redirect to home page after success
      setTimeout(() => {
        window.location.href = "/";
      }, 2000);
    } catch (error: any) {
      console.error("Verification error:", error);
      
      // Format error message
      let formattedError = error.message || "An error occurred during verification";
      let errorDetails = "";
      
      // Parse and format JSON errors
      if (formattedError.includes('{"error"')) {
        try {
          const errorStart = formattedError.indexOf('{"error"');
          const errorJSON = formattedError.substring(errorStart);
          const parsedError = JSON.parse(errorJSON);
          
          if (parsedError.error && parsedError.error.message) {
            formattedError = parsedError.error.message;
            errorDetails = JSON.stringify(parsedError, null, 2);
          }
        } catch (e) {
          // Failed to parse JSON, keep original error
        }
      }
      
      // Simplify common errors
      if (formattedError.includes("user rejected action")) {
        formattedError = "Transaction rejected";
        errorDetails = "You rejected the transaction request.";
      } else if (formattedError.includes("insufficient funds")) {
        formattedError = "Insufficient funds";
        errorDetails = "Your wallet doesn't have enough funds to complete this transaction.";
      }
      
      setErrorMessage(formattedError);
      setErrorDetails(errorDetails);
      setVerificationStatus("error");
    }
  };

  // Switch between verification methods
  const handleVerificationMethodChange = (method: "tweet" | "oauth") => {
    setVerificationMethod(method);
    setVerificationStatus("idle");
    setErrorMessage("");
    setErrorDetails("");
  };

  // Close modal handler
  const handleCloseModal = () => {
    if (verificationStatus !== "pending") {
      setShowTweetModal(false);
    }
  };

  return (
    <div className={styles.container}>
      {/* Background elements with parallax effect */}
      <div
        className={styles.waveContainer}
        style={{
          transform: `translate(${mousePosition.x * 0.2}px, ${mousePosition.y * 0.2}px)`,
        }}
      >
        <img src={cloude.src} alt="" className={styles.waveImage} />
      </div>
      <div
        className={styles.planeContainer}
        style={{
          transform: `translate(${mousePosition.x}px, ${mousePosition.y}px)`,
        }}
      >
        <img src={plane.src} alt="" className={styles.planeImage} />
      </div>
      <div
        className={styles.cloudContainer}
        style={{
          transform: `translate(${mousePosition.x * -0.3}px, ${mousePosition.y * -0.3}px)`,
        }}
      >
        <img src={whcloude.src} alt="" className={styles.cloudImage} />
      </div>
      <div
        className={styles.birdContainer}
        style={{
          transform: `translate(${mousePosition.x * -0.5}px, ${mousePosition.y * -0.5}px)`,
        }}
      >
        <img src={bird.src} alt="" className={styles.birdImage} />
      </div>
      
      {/* Title */}
      <h1 className={styles.title}>CONNECT YOUR TWITTER</h1>
      {/* Tab Navigation */}
      <div className={styles.tabsWrapper}>
        <button
          className={`${styles.tabButton} ${verificationMethod === "tweet" ? styles.tabActive : ""}`}
          onClick={() => handleVerificationMethodChange("tweet")}
        >
          <span className={styles.tabText}>Tweet to Verify</span>
        </button>
        <button
          className={`${styles.tabButton} ${verificationMethod === "oauth" ? styles.tabActive : ""}`}
          onClick={() => handleVerificationMethodChange("oauth")}
        >
          <span className={styles.tabText}>Connect with X</span>
        </button>
      </div>

      {/* Content area */}
      <div className={styles.contentArea}>
        {/* Tweet to Verify content */}
        {verificationMethod === "tweet" && (
          <>
            <p className={styles.instructionText}>
              Create a tweet with your verification code to link your X account
            </p>
            
            <div className={styles.codeBox}>
              <p className={styles.codeLabel}>Your verification code:</p>
              <p className={styles.codeValue}>{authCode}</p>
            </div>
            
            <div className={styles.buttonWrapper}>
              <button
                className={styles.actionButton}
                onClick={() => setShowTweetModal(true)}
              >
                <ButtonBackground />
                <span className={styles.buttonText}>TWEET TO VERIFY</span>
              </button>
            </div>
          </>
        )}

        {/* OAuth option */}
        {verificationMethod === "oauth" && (
          <>
            <p className={styles.instructionText}>
            Give permission to your account through standart OAuth2 protocol. Just few clicks, and you don't need to write any tweet.
            </p>
            
            <div className={styles.buttonWrapper}>
              <button
                onClick={onConnectClick}
                disabled={isConnecting}
                className={styles.actionButton}
              >
                <ButtonBackground />
                <span className={styles.buttonText}>
                  {isConnecting ? "CONNECTING..." : "CONNECT WITH X"}
                </span>
                {isConnecting && <div className={styles.buttonSpinner} />}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Tweet verification modal */}
      {showTweetModal && (
        <div className={styles.modalOverlay} onClick={handleCloseModal}>
          <div className={styles.customModalWrapper} onClick={(e) => e.stopPropagation()}>
            {/* GM Bubble and Close Button */}
            <div className={styles.gmBubble}>GM!</div>
            <button className={styles.customCloseButton} onClick={handleCloseModal}>
              CLOSE
            </button>
            
            {/* Modal Content - Different states */}
            {verificationStatus === "idle" && (
              <div className={styles.customModalContent}>
                <h3 className={styles.customModalTitle}>Tweet to Verify</h3>
                
                <p className={styles.customModalText}>
                  Click the button below to send a tweet with your verification 
                  code. Once you've tweeted, come back and click "Verify My Tweet".
                </p>
                
                <div className={styles.customTweetBox}>
                  Spreading GM vibes with GMCoin! Verification code: 
                  <br />
                  <strong className={styles.customAuthCode}>{authCode}</strong>
                </div>
                
                <button 
                  className={styles.customPostButton}
                  onClick={openTweetIntent}
                >
                  POST ON X
                </button>
                
                <button 
                  className={styles.customVerifyButton}
                  onClick={verifyTweet}
                >
                  I'VE TWEETED, VERIFY ME
                </button>
              </div>
            )}
            
            {/* Loading State */}
            {verificationStatus === "pending" && (
              <div className={styles.customModalContent}>
                <h3 className={styles.customModalTitle}>Verifying Your Tweet</h3>
                
                <div className={styles.customLoadingContainer}>
                  <div className={styles.customSpinner}></div>
                  <p className={styles.customLoadingText}>
                    Checking your tweet and verifying your account...
                  </p>
                  <p className={styles.customLoadingSubtext}>
                    This may take up to a minute. Please don't close this window.
                  </p>
                </div>
              </div>
            )}
            
            {/* Success State */}
            {verificationStatus === "success" && (
              <div className={styles.customModalContent}>
                <h3 className={styles.customModalTitle}>Verification Successful!</h3>
                
                <div className={styles.customSuccessContainer}>
                  <div className={styles.customSuccessIcon}>✓</div>
                  <p className={styles.customSuccessText}>
                    Your Twitter account has been successfully verified!
                  </p>
                  <button 
                    className={styles.customContinueButton}
                    onClick={() => {
                      setShowTweetModal(false);
                      window.location.href = "/";
                    }}
                  >
                    CONTINUE
                  </button>
                </div>
              </div>
            )}
            
            {/* Error State */}
            {verificationStatus === "error" && (
              <div className={styles.customModalContent}>
                <h3 className={styles.customModalTitle}>Verification Failed</h3>
                
                <div className={styles.customErrorContainer}>
                  <div className={styles.customErrorIcon}>!</div>
                  <p className={styles.customErrorHeading}>{errorMessage}</p>
                  {errorDetails && (
                    <div className={styles.customErrorDetails}>
                      {errorDetails}
                    </div>
                  )}
                  
                  <button 
                    className={styles.customTryAgainButton}
                    onClick={() => {
                      setVerificationStatus("idle");
                      setErrorMessage("");
                      setErrorDetails("");
                    }}
                  >
                    TRY AGAIN
                  </button>
                  
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TwitterConnect;