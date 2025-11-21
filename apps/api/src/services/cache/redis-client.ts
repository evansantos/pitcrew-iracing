/**
 * Redis Client Service
 * Manages Redis connection and provides caching utilities
 */

import { createClient, RedisClientType } from 'redis';
import { config } from '../../config/index.js';

export class RedisService {
  private client: RedisClientType | null = null;
  private isConnected = false;

  /**
   * Initialize Redis client
   */
  async connect(): Promise<void> {
    try {
      this.client = createClient({
        url: config.REDIS_URL,
        socket: {
          reconnectStrategy: (retries) => {
            if (retries > 10) {
              console.error('Redis: Max reconnection attempts reached');
              return new Error('Max reconnection attempts reached');
            }
            // Exponential backoff: 100ms, 200ms, 400ms, etc.
            return Math.min(retries * 100, 3000);
          },
        },
      });

      this.client.on('error', (err) => {
        console.error('Redis Client Error:', err);
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        console.log('Redis: Connected');
        this.isConnected = true;
      });

      this.client.on('disconnect', () => {
        console.log('Redis: Disconnected');
        this.isConnected = false;
      });

      await this.client.connect();
    } catch (error) {
      console.error('Failed to connect to Redis:', error);
      throw error;
    }
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.isConnected = false;
    }
  }

  /**
   * Check if Redis is connected
   */
  isReady(): boolean {
    return this.isConnected && this.client !== null;
  }

  /**
   * Set a key-value pair with optional expiration
   */
  async set(key: string, value: any, expirationSeconds?: number): Promise<void> {
    if (!this.client) throw new Error('Redis client not initialized');

    const serialized = JSON.stringify(value);

    if (expirationSeconds) {
      await this.client.setEx(key, expirationSeconds, serialized);
    } else {
      await this.client.set(key, serialized);
    }
  }

  /**
   * Get a value by key
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.client) throw new Error('Redis client not initialized');

    const value = await this.client.get(key);
    if (!value) return null;

    try {
      return JSON.parse(value) as T;
    } catch (error) {
      console.error('Failed to parse Redis value:', error);
      return null;
    }
  }

  /**
   * Delete a key
   */
  async delete(key: string): Promise<void> {
    if (!this.client) throw new Error('Redis client not initialized');
    await this.client.del(key);
  }

  /**
   * Delete multiple keys matching a pattern
   */
  async deletePattern(pattern: string): Promise<void> {
    if (!this.client) throw new Error('Redis client not initialized');

    const keys = await this.client.keys(pattern);
    if (keys.length > 0) {
      await this.client.del(keys);
    }
  }

  /**
   * Check if a key exists
   */
  async exists(key: string): Promise<boolean> {
    if (!this.client) throw new Error('Redis client not initialized');
    const result = await this.client.exists(key);
    return result === 1;
  }

  /**
   * Set expiration on a key
   */
  async expire(key: string, seconds: number): Promise<void> {
    if (!this.client) throw new Error('Redis client not initialized');
    await this.client.expire(key, seconds);
  }

  /**
   * Get time to live for a key
   */
  async ttl(key: string): Promise<number> {
    if (!this.client) throw new Error('Redis client not initialized');
    return await this.client.ttl(key);
  }

  /**
   * Increment a counter
   */
  async increment(key: string, amount: number = 1): Promise<number> {
    if (!this.client) throw new Error('Redis client not initialized');
    return await this.client.incrBy(key, amount);
  }

  /**
   * Add item to a list (right push)
   */
  async listPush(key: string, value: any): Promise<void> {
    if (!this.client) throw new Error('Redis client not initialized');
    const serialized = JSON.stringify(value);
    await this.client.rPush(key, serialized);
  }

  /**
   * Get list range
   */
  async listRange<T>(key: string, start: number, end: number): Promise<T[]> {
    if (!this.client) throw new Error('Redis client not initialized');

    const values = await this.client.lRange(key, start, end);
    return values.map((v) => JSON.parse(v) as T);
  }

  /**
   * Trim list to specified range
   */
  async listTrim(key: string, start: number, end: number): Promise<void> {
    if (!this.client) throw new Error('Redis client not initialized');
    await this.client.lTrim(key, start, end);
  }

  /**
   * Get list length
   */
  async listLength(key: string): Promise<number> {
    if (!this.client) throw new Error('Redis client not initialized');
    return await this.client.lLen(key);
  }

  /**
   * Add to sorted set
   */
  async sortedSetAdd(key: string, score: number, member: string): Promise<void> {
    if (!this.client) throw new Error('Redis client not initialized');
    await this.client.zAdd(key, { score, value: member });
  }

  /**
   * Get sorted set range by score
   */
  async sortedSetRangeByScore(
    key: string,
    min: number,
    max: number
  ): Promise<string[]> {
    if (!this.client) throw new Error('Redis client not initialized');
    return await this.client.zRangeByScore(key, min, max);
  }

  /**
   * Publish message to channel
   */
  async publish(channel: string, message: any): Promise<void> {
    if (!this.client) throw new Error('Redis client not initialized');
    const serialized = JSON.stringify(message);
    await this.client.publish(channel, serialized);
  }

  /**
   * Get all keys matching pattern
   */
  async keys(pattern: string): Promise<string[]> {
    if (!this.client) throw new Error('Redis client not initialized');
    return await this.client.keys(pattern);
  }

  /**
   * Flush all data (use with caution!)
   */
  async flushAll(): Promise<void> {
    if (!this.client) throw new Error('Redis client not initialized');
    await this.client.flushAll();
  }
}

// Singleton instance
export const redisService = new RedisService();
