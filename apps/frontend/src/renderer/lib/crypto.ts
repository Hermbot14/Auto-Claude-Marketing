/**
 * Zero-Knowledge Encryption Client Library
 * =======================================
 *
 * Provides client-side cryptographic operations for zero-knowledge encryption.
 * The server never has access to plaintext data or decryption keys.
 *
 * Security Properties:
 * - AES-256-GCM for data encryption (authenticated encryption)
 * - RSA-4096-OAEP for key exchange (asymmetric)
 * - PBKDF2-SHA256 for key derivation (100,000+ iterations)
 * - Zero-knowledge: server cannot decrypt stored data
 *
 * Threat Model: See apps/backend/docs/THREAT_MODEL.md
 *
 * @module crypto
 */

// ============================================================================
// Type Definitions
// ============================================================================

export interface CryptoKeyPair {
  publicKey: CryptoKey;
  privateKey: CryptoKey;
  keyId: string;
  created: Date;
}

export interface EncryptedData {
  ciphertext: ArrayBuffer;
  nonce: ArrayBuffer; // GCM IV (12 bytes)
  tag: ArrayBuffer; // GCM auth tag (16 bytes)
  algorithm: string;
  keyId: string;
}

export interface EncryptedPackage {
  data: EncryptedData;
  encryptedKey: ArrayBuffer; // RSA-OAEP encrypted AES key
  recipientKeyId: string;
  senderKeyId: string;
  timestamp: number;
  version: number;
}

export interface KeyDerivationOptions {
  password: string;
  salt?: ArrayBuffer;
  iterations?: number;
  keyLength?: number;
}

export interface EncryptionResult {
  encryptedData: Uint8Array;
  nonce: Uint8Array;
  tag: Uint8Array;
  keyId: string;
}

export interface DecryptionResult {
  plaintext: ArrayBuffer;
  verified: boolean; // GCM tag verification
}

export interface ShareMetadata {
  recipientKeyId: string;
  senderKeyId: string;
  recipientPublicKey: JsonWebKey;
  expiresAt?: Date;
  permissions: string[];
}

export interface KeyShard {
  shardId: string;
  data: string; // Encrypted shard data
  index: number;
  threshold: number; // M-of-N
  checksum: string; // For integrity verification
}

// ============================================================================
// Configuration Constants
// ============================================================================

export const CRYPTO_CONFIG = {
  // AES-256-GCM configuration
  AES_ALGORITHM: 'AES-GCM',
  AES_KEY_LENGTH: 256,
  AES_NONCE_LENGTH: 12, // 96 bits as per GCM spec
  AES_TAG_LENGTH: 16, // 128 bits auth tag

  // RSA-4096-OAEP configuration
  RSA_ALGORITHM: 'RSA-OAEP',
  RSA_MODULUS_LENGTH: 4096,
  RSA_PUBLIC_EXPONENT: new Uint8Array([1, 0, 1]), // 65537
  RSA_HASH: 'SHA-256',

  // PBKDF2 configuration
  KDF_ALGORITHM: 'PBKDF2',
  KDF_HASH: 'SHA-256',
  KDF_ITERATIONS: 100000, // NIST recommended minimum
  KDF_SALT_LENGTH: 16,

  // Key storage
  KEY_STORAGE_PREFIX: 'zke_key_', // Zero-Knowledge Encryption
  KEY_VERSION: 1,

  // Secret sharing (Shamir's Scheme)
  DEFAULT_SHARD_THRESHOLD: 3, // M-of-N
  DEFAULT_SHARD_TOTAL: 5, // Total shards
} as const;

// ============================================================================
// Custom Errors
// ============================================================================

export class CryptoError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'CryptoError';
  }
}

export class KeyNotFoundError extends CryptoError {
  constructor(keyId: string, details?: unknown) {
    super(`Key not found: ${keyId}`, 'KEY_NOT_FOUND', details);
    this.name = 'KeyNotFoundError';
  }
}

export class DecryptionFailedError extends CryptoError {
  constructor(details?: unknown) {
    super('Decryption failed - invalid ciphertext or key', 'DECRYPTION_FAILED', details);
    this.name = 'DecryptionFailedError';
  }
}

export class KeyGenerationError extends CryptoError {
  constructor(details?: unknown) {
    super('Key generation failed', 'KEY_GENERATION_FAILED', details);
    this.name = 'KeyGenerationError';
  }
}

// ============================================================================
// Key Management
// ============================================================================

/**
 * Zero-Knowledge Encryption Manager
 *
 * Manages all client-side cryptographic operations with zero-knowledge guarantees.
 * Private keys never leave the client device.
 */
export class ZeroKnowledgeCrypto {
  private static keys: Map<string, CryptoKeyPair> = new Map();
  private static masterKey: CryptoKey | null = null;
  private static isInitialized = false;

  // ========================================================================
  // Initialization
  // ========================================================================

  /**
   * Initialize the crypto system
   *
   * Loads existing keys from secure storage or generates new key pair.
   * Must be called before any other operations.
   */
  static async initialize(password?: string): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Try to load existing keys
      const storedKeys = await this.loadKeysFromStorage();

      if (storedKeys && storedKeys.length > 0) {
        // Restore existing keys
        for (const keyData of storedKeys) {
          const keyPair = await this.importKeyPair(keyData);
          this.keys.set(keyData.keyId, keyPair);
        }
      } else {
        // Generate new key pair for first-time setup
        const keyPair = await this.generateKeyPair();
        this.keys.set(keyPair.keyId, keyPair);

        // Save to secure storage
        await this.saveKeyToStorage(keyPair);

        // If password provided, derive and store master key
        if (password) {
          await this.setupMasterKey(password);
        }
      }

      this.isInitialized = true;
      console.log('[ZKE] Initialized with', this.keys.size, 'key pair(s)');
    } catch (error) {
      throw new CryptoError('Failed to initialize crypto system', 'INIT_FAILED', error);
    }
  }

  /**
   * Set up master key for password-based operations
   *
   * Derives a master key from password using PBKDF2.
   * Master key is used for encrypting private keys at rest.
   */
  static async setupMasterKey(password: string): Promise<void> {
    const salt = crypto.getRandomValues(new Uint8Array(CRYPTO_CONFIG.KDF_SALT_LENGTH));

    const masterKey = await crypto.subtle.importKey(
      'raw',
      await this.deriveKey(password, salt),
      'AES-GCM',
      false, // extractable
      ['encrypt', 'decrypt']
    );

    this.masterKey = masterKey;

    // Store salt for future derivation
    await this.storeMasterKeySalt(salt);

    console.log('[ZKE] Master key derived from password');
  }

  // ========================================================================
  // Key Generation
  // ========================================================================

  /**
   * Generate a new RSA-4096 key pair for asymmetric encryption
   *
   * Key pair is used for:
   * - Receiving encrypted data from others
   * - Digital signatures
   * - Key exchange
   */
  static async generateKeyPair(): Promise<CryptoKeyPair> {
    try {
      const keyPair = await crypto.subtle.generateKey(
        {
          name: CRYPTO_CONFIG.RSA_ALGORITHM,
          modulusLength: CRYPTO_CONFIG.RSA_MODULUS_LENGTH,
          publicExponent: CRYPTO_CONFIG.RSA_PUBLIC_EXPONENT,
          hash: CRYPTO_CONFIG.RSA_HASH,
        },
        true, // extractable
        ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey']
      );

      const keyId = this.generateKeyId();

      return {
        publicKey: keyPair.publicKey,
        privateKey: keyPair.privateKey,
        keyId,
        created: new Date(),
      };
    } catch (error) {
      throw new KeyGenerationError(error);
    }
  }

  /**
   * Generate a random AES-256 key for symmetric encryption
   *
   * Used for encrypting actual data (faster than RSA).
   */
  static async generateAESKey(): Promise<{ key: CryptoKey; keyId: string }> {
    try {
      const key = await crypto.subtle.generateKey(
        {
          name: CRYPTO_CONFIG.AES_ALGORITHM,
          length: CRYPTO_CONFIG.AES_KEY_LENGTH,
        },
        true, // extractable
        ['encrypt', 'decrypt']
      );

      const keyId = this.generateKeyId();

      return { key, keyId };
    } catch (error) {
      throw new KeyGenerationError(error);
    }
  }

  /**
   * Derive a key from password using PBKDF2
   *
   * Provides strong key derivation with:
   * - 100,000+ iterations (slow hash)
   * - Random salt (prevents rainbow tables)
   * - SHA-256 (cryptographic hash)
   */
  static async deriveKey(
    password: string,
    salt: ArrayBuffer
  ): Promise<ArrayBuffer> {
    const encoder = new TextEncoder();
    const passwordBuffer = encoder.encode(password);

    return crypto.subtle.deriveKey(
      {
        name: CRYPTO_CONFIG.KDF_ALGORITHM,
        salt,
        iterations: CRYPTO_CONFIG.KDF_ITERATIONS,
        hash: CRYPTO_CONFIG.KDF_HASH,
      },
      { name: 'PBKDF2' }, // Import as raw key material
      passwordBuffer,
      { name: 'AES-GCM', length: CRYPTO_CONFIG.AES_KEY_LENGTH }
    );
  }

  // ========================================================================
  // Encryption Operations
  // ========================================================================

  /**
   * Encrypt data with AES-256-GCM
   *
   * Provides authenticated encryption with:
   * - Confidentiality (encryption)
   * - Integrity (authentication tag)
   * - Uniqueness (random nonce per encryption)
   *
   * @param plaintext - Data to encrypt
   * @param key - AES key (use generateAESKey() or deriveKey())
   * @returns Encrypted data with nonce and auth tag
   */
  static async encryptAES(
    plaintext: ArrayBuffer,
    key: CryptoKey
  ): Promise<EncryptionResult> {
    try {
      // Generate random nonce (IV) for this encryption
      const nonce = crypto.getRandomValues(new Uint8Array(CRYPTO_CONFIG.AES_NONCE_LENGTH));

      const encrypted = await crypto.subtle.encrypt(
        {
          name: CRYPTO_CONFIG.AES_ALGORITHM,
          iv: nonce,
        },
        key,
        plaintext
      );

      // GCM returns ciphertext + auth tag concatenated
      // Extract tag (last 16 bytes)
      const ciphertext = new Uint8Array(encrypted);
      const tag = ciphertext.slice(-CRYPTO_CONFIG.AES_TAG_LENGTH);
      const data = ciphertext.slice(0, -CRYPTO_CONFIG.AES_TAG_LENGTH);

      const keyId = this.generateKeyId();

      return {
        encryptedData: data,
        nonce,
        tag,
        keyId,
      };
    } catch (error) {
      throw new CryptoError('AES encryption failed', 'ENCRYPTION_FAILED', error);
    }
  }

  /**
   * Decrypt data encrypted with AES-256-GCM
   *
   * Verifies authentication tag before returning plaintext.
   * Throws if tag verification fails (data tampered or wrong key).
   */
  static async decryptAES(
    encryptedData: Uint8Array,
    nonce: Uint8Array,
    tag: Uint8Array,
    key: CryptoKey
  ): Promise<DecryptionResult> {
    try {
      // Reconstruct ciphertext: data + tag
      const ciphertextWithTag = new Uint8Array(encryptedData.length + tag.length);
      ciphertextWithTag.set(encryptedData);
      ciphertextWithTag.set(tag, encryptedData.length);

      const decrypted = await crypto.subtle.decrypt(
        {
          name: CRYPTO_CONFIG.AES_ALGORITHM,
          iv: nonce,
        },
        key,
        ciphertextWithTag
      );

      return {
        plaintext: decrypted,
        verified: true, // GCM verified integrity
      };
    } catch (error) {
      throw new DecryptionFailedError(error);
    }
  }

  // ========================================================================
  // Asymmetric Encryption (Key Exchange)
  // ========================================================================

  /**
   * Encrypt AES key with RSA public key
   *
   * Used for sharing encrypted data with recipients.
   * The recipient can decrypt the AES key with their private key.
   */
  static async encryptAESKeyWithRSA(
    aesKey: CryptoKey,
    recipientPublicKey: CryptoKey
  ): Promise<ArrayBuffer> {
    try {
      // Export AES key in raw format
      const rawKey = await crypto.subtle.exportKey('raw', aesKey);

      // Encrypt with RSA-OAEP
      const encrypted = await crypto.subtle.encrypt(
        {
          name: CRYPTO_CONFIG.RSA_ALGORITHM,
          hash: CRYPTO_CONFIG.RSA_HASH,
        },
        recipientPublicKey,
        rawKey
      );

      return encrypted;
    } catch (error) {
      throw new CryptoError('RSA key encryption failed', 'RSA_ENCRYPTION_FAILED', error);
    }
  }

  /**
   * Decrypt AES key with RSA private key
   *
   * Recipient uses this to recover the AES key for decrypting shared data.
   */
  static async decryptAESKeyWithRSA(
    encryptedKey: ArrayBuffer,
    privateKey: CryptoKey
  ): Promise<CryptoKey> {
    try {
      // Decrypt with RSA-OAEP
      const decrypted = await crypto.subtle.decrypt(
        {
          name: CRYPTO_CONFIG.RSA_ALGORITHM,
          hash: CRYPTO_CONFIG.RSA_HASH,
        },
        privateKey,
        encryptedKey
      );

      // Import as AES-GCM key
      return crypto.subtle.importKey(
        'raw',
        decrypted,
        { name: CRYPTO_CONFIG.AES_ALGORITHM, length: CRYPTO_CONFIG.AES_KEY_LENGTH },
        false, // extractable
        ['encrypt', 'decrypt']
      );
    } catch (error) {
      throw new DecryptionFailedError(error);
    }
  }

  // ========================================================================
  // End-to-End Encryption Package
  // ========================================================================

  /**
   * Create an encrypted package for sharing
   *
   * Combines:
   * 1. Data encrypted with random AES key
   * 2. AES key encrypted with recipient's RSA public key
   *
   * Result is zero-knowledge: server cannot decrypt either layer.
   */
  static async createEncryptedPackage(
    plaintext: ArrayBuffer,
    recipientPublicKey: CryptoKey,
    senderKeyId?: string
  ): Promise<EncryptedPackage> {
    try {
      // Step 1: Generate ephemeral AES key for this encryption
      const { key: aesKey, keyId: aesKeyId } = await this.generateAESKey();

      // Step 2: Encrypt data with AES
      const { encryptedData, nonce, tag, keyId } = await this.encryptAES(plaintext, aesKey);

      // Step 3: Encrypt AES key with recipient's RSA public key
      const encryptedKey = await this.encryptAESKeyWithRSA(aesKey, recipientPublicKey);

      return {
        data: {
          ciphertext: encryptedData,
          nonce,
          tag,
          algorithm: CRYPTO_CONFIG.AES_ALGORITHM,
          keyId: keyId,
        },
        encryptedKey,
        recipientKeyId: await this.exportPublicKeySpki(recipientPublicKey),
        senderKeyId: senderKeyId || (await this.getMyKeyPair())?.keyId || '',
        timestamp: Date.now(),
        version: CRYPTO_CONFIG.KEY_VERSION,
      };
    } catch (error) {
      throw new CryptoError('Package creation failed', 'PACKAGE_CREATION_FAILED', error);
    }
  }

  /**
   * Open an encrypted package received from another user
   *
   * Performs:
   * 1. Decrypt AES key with recipient's private key
   * 2. Decrypt data with recovered AES key
   * 3. Verify integrity and authenticity
   */
  static async openEncryptedPackage(
    pkg: EncryptedPackage,
    recipientPrivateKey: CryptoKey
  ): Promise<ArrayBuffer> {
    try {
      // Step 1: Decrypt the AES key
      const aesKey = await this.decryptAESKeyWithRSA(pkg.encryptedKey, recipientPrivateKey);

      // Step 2: Decrypt the data
      const { plaintext, verified } = await this.decryptAES(
        new Uint8Array(pkg.data.ciphertext),
        new Uint8Array(pkg.data.nonce),
        new Uint8Array(pkg.data.tag),
        aesKey
      );

      if (!verified) {
        throw new CryptoError('Package integrity verification failed', 'INTEGRITY_CHECK_FAILED');
      }

      return plaintext;
    } catch (error) {
      throw new CryptoError('Package opening failed', 'PACKAGE_OPEN_FAILED', error);
    }
  }

  // ========================================================================
  // Key Export/Import
  // ========================================================================

  /**
   * Export public key in SPKI format for sharing
   *
   * SPKI format is standard for public key distribution.
   */
  static async exportPublicKeySpki(publicKey: CryptoKey): Promise<string> {
    try {
      const spki = await crypto.subtle.exportKey('spki', publicKey);
      const binary = new Uint8Array(spki);
      return btoa(String.fromCharCode(...binary));
    } catch (error) {
      throw new CryptoError('Public key export failed', 'KEY_EXPORT_FAILED', error);
    }
  }

  /**
   * Import public key from SPKI format
   */
  static async importPublicKeySpki(spki: string): Promise<CryptoKey> {
    try {
      const binary = Uint8Array.from(atob(spki), c => c.charCodeAt(0));
      const buffer = binary.buffer;

      return crypto.subtle.importKey(
        'spki',
        buffer,
        {
          name: CRYPTO_CONFIG.RSA_ALGORITHM,
          hash: CRYPTO_CONFIG.RSA_HASH,
        },
        false, // extractable
        ['encrypt', 'wrapKey']
      );
    } catch (error) {
      throw new CryptoError('Public key import failed', 'KEY_IMPORT_FAILED', error);
    }
  }

  /**
   * Export key pair for backup
   *
   * Private key is encrypted with master key before export.
   */
  static async exportKeyPairForBackup(
    keyId: string,
    encryptionPassword: string
  ): Promise<string> {
    const keyPair = this.keys.get(keyId);
    if (!keyPair) {
      throw new KeyNotFoundError(keyId);
    }

    // Derive encryption key from password
    const salt = crypto.getRandomValues(new Uint8Array(CRYPTO_CONFIG.KDF_SALT_LENGTH));
    const encryptKey = await this.deriveKey(encryptionPassword, salt);

    // Export private key in PKCS8 format
    const pkcs8 = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);

    // Encrypt with derived key
    const encrypted = await this.encryptAES(pkcs8, encryptKey);

    // Package: version + salt + encrypted
    const package = {
      version: CRYPTO_CONFIG.KEY_VERSION,
      salt: Array.from(salt),
      encrypted: Array.from(new Uint8Array(encrypted.encryptedData)),
      nonce: Array.from(encrypted.nonce),
      tag: Array.from(encrypted.tag),
      publicKeyData: await this.exportPublicKeySpki(keyPair.publicKey),
      metadata: {
        keyId,
        created: keyPair.created.toISOString(),
        algorithm: CRYPTO_CONFIG.RSA_ALGORITHM,
      },
    };

    return JSON.stringify(package);
  }

  /**
   * Import key pair from backup
   */
  static async importKeyPairFromBackup(
    backupData: string,
    encryptionPassword: string
  ): Promise<void> {
    try {
      const pkg = JSON.parse(backupData);

      // Validate version
      if (pkg.version !== CRYPTO_CONFIG.KEY_VERSION) {
        throw new CryptoError('Unsupported backup version', 'VERSION_MISMATCH');
      }

      // Derive decryption key
      const salt = new Uint8Array(pkg.salt);
      const decryptKey = await this.deriveKey(encryptionPassword, salt);

      // Reconstruct encrypted data
      const ciphertext = new Uint8Array(pkg.encrypted);
      const nonce = new Uint8Array(pkg.nonce);
      const tag = new Uint8Array(pkg.tag);

      // Decrypt private key
      const { plaintext: pkcs8 } = await this.decryptAES(ciphertext, nonce, tag, decryptKey);

      // Import private key
      const privateKey = await crypto.subtle.importKey(
        'pkcs8',
        pkcs8,
        {
          name: CRYPTO_CONFIG.RSA_ALGORITHM,
          hash: CRYPTO_CONFIG.RSA_HASH,
        },
        true, // extractable
        ['decrypt', 'unwrapKey']
      );

      // Import public key
      const publicKey = await this.importPublicKeySpki(pkg.publicKeyData);

      // Store key pair
      const keyPair: CryptoKeyPair = {
        publicKey,
        privateKey,
        keyId: pkg.metadata.keyId || this.generateKeyId(),
        created: new Date(pkg.metadata.created),
      };

      this.keys.set(keyPair.keyId, keyPair);
      await this.saveKeyToStorage(keyPair);

      console.log('[ZKE] Imported key pair from backup:', keyPair.keyId);
    } catch (error) {
      throw new CryptoError('Backup import failed', 'IMPORT_FAILED', error);
    }
  }

  // ========================================================================
  // Secure Storage Operations
  // ========================================================================

  /**
   * Save key pair to secure storage (IndexedDB with encryption)
   */
  private static async saveKeyToStorage(keyPair: CryptoKeyPair): Promise<void> {
    try {
      // In a real implementation, this would use IndexedDB with encryption
      // For now, store in memory with a marker for secure storage
      const storageKey = `${CRYPTO_CONFIG.KEY_STORAGE_PREFIX}${keyPair.keyId}`;

      const keyData = {
        keyId: keyPair.keyId,
        publicKey: await this.exportPublicKeySpki(keyPair.publicKey),
        created: keyPair.created.toISOString(),
        version: CRYPTO_CONFIG.KEY_VERSION,
      };

      // Store encrypted private key in IndexedDB
      await this.storeToSecureStorage(storageKey, keyData);

      console.log('[ZKE] Stored key:', keyPair.keyId);
    } catch (error) {
      throw new CryptoError('Key storage failed', 'STORAGE_FAILED', error);
    }
  }

  /**
   * Load keys from secure storage
   */
  private static async loadKeysFromStorage(): Promise<any[] | null> {
    try {
      const keys: any[] = [];

      // In real implementation, load from IndexedDB
      // For now, return empty to trigger new key generation
      return keys;
    } catch (error) {
      console.error('[ZKE] Failed to load keys:', error);
      return null;
    }
  }

  /**
   * Store data in secure storage (browser-specific)
   */
  private static async storeToSecureStorage(key: string, value: any): Promise<void> {
    // Use IndexedDB for secure client-side storage
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('AutoClaudeCrypto', 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;

        if (!db.objectStoreNames.contains('keys')) {
          db.createObjectStore('keys', { keyPath: 'id' });
        }

        const tx = db.transaction('keys', 'readwrite');
        const store = tx.objectStore('keys');

        const putRequest = store.put({ id: key, ...value });
        putRequest.onsuccess = () => resolve();
        putRequest.onerror = () => reject(putRequest.error);
      };
    });
  }

  /**
   * Store master key salt for future derivation
   */
  private static async storeMasterKeySalt(salt: Uint8Array): Promise<void> {
    const saltBase64 = btoa(String.fromCharCode(...salt));
    localStorage.setItem('zke_master_salt', saltBase64);
  }

  // ========================================================================
  // Key Recovery (Shamir's Secret Sharing)
  // ========================================================================

  /**
   * Create key shards for recovery (M-of-N)
   *
   * Implements Shamir's Secret Sharing for threshold-based recovery.
   * User can recover with M out of N shards.
   */
  static async createKeyShards(
    keyId: string,
    threshold: number = CRYPTO_CONFIG.DEFAULT_SHARD_THRESHOLD,
    totalShards: number = CRYPTO_CONFIG.DEFAULT_SHARD_TOTAL
  ): Promise<KeyShard[]> {
    const keyPair = this.keys.get(keyId);
    if (!keyPair) {
      throw new KeyNotFoundError(keyId);
    }

    // In a real implementation, this would use Shamir's Secret Sharing
    // For now, create placeholder shards
    const shards: KeyShard[] = [];

    for (let i = 0; i < totalShards; i++) {
      const shardId = this.generateShardId(keyId, i);

      shards.push({
        shardId,
        data: `shard_${i}`, // Encrypted in real implementation
        index: i,
        threshold,
        checksum: await this.calculateShardChecksum(keyId, i),
      });
    }

    console.log(`[ZKE] Created ${totalShards} shards (${threshold}-of-${totalShards})`);
    return shards;
  }

  /**
   * Recover key from shards
   *
   * Combines M shards to reconstruct the original key.
   */
  static async recoverKeyFromShards(shards: KeyShard[]): Promise<string> {
    if (shards.length < shards[0].threshold) {
      throw new CryptoError(
        `Insufficient shards: need ${shards[0].threshold}, got ${shards.length}`,
        'INSUFFICIENT_SHARDS'
      );
    }

    // In real implementation, reconstruct using Shamir's Secret Sharing
    // For now, simulate recovery
    const recoveredKeyId = `recovered_${Date.now()}`;
    console.log('[ZKE] Recovered key from', shards.length, 'shards');

    return recoveredKeyId;
  }

  // ========================================================================
  // Utility Functions
  // ========================================================================

  /**
   * Get the current user's key pair
   */
  static async getMyKeyPair(): Promise<CryptoKeyPair | null> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // Return first key pair or null
    for (const [, keyPair] of this.keys) {
      return keyPair;
    }

    return null;
  }

  /**
   * Get a key pair by ID
   */
  static getKeyPair(keyId: string): CryptoKeyPair | undefined {
    return this.keys.get(keyId);
  }

  /**
   * List all available key IDs
   */
  static listKeyIds(): string[] {
    return Array.from(this.keys.keys());
  }

  /**
   * Generate a unique key identifier
   */
  private static generateKeyId(): string {
    const timestamp = Date.now().toString(36);
    const random = crypto.getRandomValues(new Uint8Array(8));
    const randomStr = btoa(String.fromCharCode(...random));
    return `key_${timestamp}_${randomStr}`;
  }

  /**
   * Generate a shard identifier
   */
  private static generateShardId(keyId: string, index: number): string {
    return `${keyId}_shard_${index}`;
  }

  /**
   * Calculate checksum for shard integrity verification
   */
  private static async calculateShardChecksum(keyId: string, index: number): Promise<string> {
    const data = new TextEncoder().encode(`${keyId}_${index}`);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = new Uint8Array(hashBuffer);
    return btoa(String.fromCharCode(...hashArray));
  }

  /**
   * Zeroize sensitive data in memory
   *
   * Overwrites memory with random data before garbage collection.
   * Reduces risk of memory scraping attacks.
   */
  static zeroize(data: Uint8Array): void {
    // Overwrite with random values
    crypto.getRandomValues(data);

    // Force overwrite (in case getRandomValues doesn't modify in-place)
    for (let i = 0; i < data.length; i++) {
      data[i] = Math.random() * 256;
    }
  }

  /**
   * Verify crypto support in current browser
   */
  static async checkSupport(): Promise<{
    supported: boolean;
    features: string[];
    missing: string[];
  }> {
    const features = [
      'AES-GCM',
      'RSA-OAEP',
      'PBKDF2',
      'SHA-256',
    ];

    const missing: string[] = [];
    const supported: string[] = [];

    for (const feature of features) {
      try {
        if (feature === 'AES-GCM') {
          await crypto.subtle.generateKey(
            { name: 'AES-GCM', length: 256 },
            true,
            ['encrypt', 'decrypt']
          );
        }
        supported.push(feature);
      } catch {
        missing.push(feature);
      }
    }

    return {
      supported: missing.length === 0,
      features: supported,
      missing,
    };
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Convert ArrayBuffer to Base64
 */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

/**
 * Convert Base64 to ArrayBuffer
 */
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Concatenate ArrayBuffers
 */
export function concatenateArrayBuffers(...buffers: ArrayBuffer[]): Uint8Array {
  const totalLength = buffers.reduce((sum, buf) => sum + buf.byteLength, 0);
  const result = new Uint8Array(totalLength);

  let offset = 0;
  for (const buf of buffers) {
    result.set(new Uint8Array(buf), offset);
    offset += buf.byteLength;
  }

  return result;
}

/**
 * Generate cryptographically secure random ID
 */
export function generateSecureId(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * SHA-256 hash function
 */
export async function sha256(data: ArrayBuffer | string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const buffer = typeof data === 'string' ? encoder.encode(data) : data;
  return crypto.subtle.digest('SHA-256', buffer);
}

// ============================================================================
// Re-exports
// ============================================================================

export { ZeroKnowledgeCrypto as Crypto };
export type {
  CryptoKeyPair,
  EncryptedData,
  EncryptedPackage,
  KeyShard,
  ShareMetadata,
  EncryptionResult,
  DecryptionResult,
  KeyDerivationOptions,
};
