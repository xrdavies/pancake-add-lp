import { ethers } from 'ethers';
import * as ui from './ui.js';
import { fetchAndSetCurrentTick } from './pancakeswap.js';

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
      sessionStorage.setItem('isConnected', 'true');
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
  sessionStorage.removeItem('isConnected');
  ui.showDisconnectedState();
}

async function updateWalletStatus() {
  if (!signer) {
    ui.showDisconnectedState();
    return;
  }

  try {
    const account = await signer.getAddress();
    const network = await provider.getNetwork();

    if (!account) {
      throw new Error('Account not found or wallet is locked.');
    }

    ui.showConnectedState(account, network, BSC_CHAIN_ID);
    fetchAndSetCurrentTick(); // Automatically fetch tick for the default pool
  } catch (error) {
    console.error('Failed to update wallet status, resetting UI.', error);
    ui.showDisconnectedState();
  }
}

export async function initializeWallet() {
  if (!window.ethereum) {
    ui.showDisconnectedState();
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

  const isConnected = sessionStorage.getItem('isConnected');
  if (!isConnected) {
    ui.showDisconnectedState();
    return;
  }

  try {
    const accounts = await provider.listAccounts();
    if (accounts.length === 0) {
      ui.showDisconnectedState();
      return;
    }

    signer = provider.getSigner();
    await signer.getAddress(); // Crucial test for locked wallet

    await updateWalletStatus();
  } catch (error) {
    console.log('Initial connection check failed, setting UI to disconnected.', error.message);
    ui.showDisconnectedState();
  }
}
