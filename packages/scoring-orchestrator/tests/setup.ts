import { jest } from "@jest/globals";

// Mock fetch globally with proper typing
Object.defineProperty(global, 'fetch', {
  value: jest.fn(),
  writable: true,
});
