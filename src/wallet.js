import { ethers } from 'ethers';
import { showConnectedState, showDisconnectedState } from './ui.js';

// --- State ---
export let provider;
export let signer;

// --- Constants ---
const BSC_CHAIN_ID = 56;

// --- Wallet Functions ---
export async function connectWallet() {
  if (window.ethereum) {
    try {
      provider = new ethers.providers.Web3Provider(window.ethereum);
      await provider.send('eth_requestAccounts', []);
      signer = provider.getSigner();
      await updateWalletStatus();
    } catch (err) {
      console.error('User rejected connection:', err);
      alert('Could not connect to wallet. Please approve the connection in MetaMask.');
    }
  } else {
    alert('MetaMask is not installed. Please install it to use this app.');
  }
}

export function disconnectWallet() {
  signer = null;
  showDisconnectedState();
}

async function updateWalletStatus() {
  if (!signer) {
    showDisconnectedState();
    return;
  }

  try {
    const account = await signer.getAddress();
    const network = await provider.getNetwork();

    if (!account) {
      throw new Error('Account not found or wallet is locked.');
    }

    showConnectedState(account, network, BSC_CHAIN_ID);
  } catch (error) {
    console.error('Failed to update wallet status, resetting UI.', error);
    showDisconnectedState();
  }
}

export async function initializeWallet() {
  if (!window.ethereum) {
    showDisconnectedState();
    return;
  }

  provider = new ethers.providers.Web3Provider(window.ethereum);

  window.ethereum.on('accountsChanged', async (accounts) => {
    if (accounts.length > 0) {
      signer = provider.getSigner();
    } else {
      signer = null;
    }
    await updateWalletStatus();
  });
  window.ethereum.on('chainChanged', () => window.location.reload());

  try {
    const accounts = await provider.listAccounts();
    if (accounts.length === 0) {
      showDisconnectedState();
      return;
    }

    signer = provider.getSigner();
    await signer.getAddress(); // Crucial test for locked wallet

    await updateWalletStatus();
  } catch (error) {
    console.log('Initial connection check failed, setting UI to disconnected.', error.message);
    showDisconnectedState();
  }
}
