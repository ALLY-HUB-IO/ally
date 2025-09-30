import { AxiosError } from 'axios';
import { ApiResponse } from '../types';

/**
 * Extracts a user-friendly error message from an API error response
 * @param error - The error object (usually from axios or API service)
 * @param fallbackMessage - Default message if no specific error is found
 * @returns A user-friendly error message
 */
export const getErrorMessage = (error: unknown, fallbackMessage: string = 'An unexpected error occurred'): string => {
  // Handle axios errors
  if (error && typeof error === 'object' && 'response' in error) {
    const axiosError = error as AxiosError<ApiResponse<any>>;
    
    // Check if the response contains our API error format
    if (axiosError.response?.data) {
      const apiResponse = axiosError.response.data;
      
      // Return the specific error message from the API
      if (apiResponse.error) {
        return apiResponse.error;
      }
      
      // Fallback to details or message if available
      if (apiResponse.details) {
        return apiResponse.details;
      }
      
      if (apiResponse.message) {
        return apiResponse.message;
      }
    }
    
    // Handle HTTP status codes with generic messages
    if (axiosError.response?.status) {
      switch (axiosError.response.status) {
        case 400:
          return 'Invalid request. Please check your input and try again.';
        case 401:
          return 'You are not authorized to perform this action.';
        case 403:
          return 'Access denied. You do not have permission to perform this action.';
        case 404:
          return 'The requested resource was not found.';
        case 409:
          return 'A conflict occurred. The resource may already exist or be in use.';
        case 422:
          return 'Validation failed. Please check your input and try again.';
        case 429:
          return 'Too many requests. Please wait a moment and try again.';
        case 500:
          return 'Server error. Please try again later.';
        case 502:
        case 503:
        case 504:
          return 'Service temporarily unavailable. Please try again later.';
        default:
          return `Request failed with status ${axiosError.response.status}`;
      }
    }
    
    // Handle network errors
    if (axiosError.code === 'NETWORK_ERROR' || axiosError.message.includes('Network Error')) {
      return 'Network error. Please check your connection and try again.';
    }
    
    if (axiosError.code === 'ECONNABORTED' || axiosError.message.includes('timeout')) {
      return 'Request timed out. Please try again.';
    }
  }
  
  // Handle standard Error objects
  if (error instanceof Error) {
    return error.message;
  }
  
  // Handle string errors
  if (typeof error === 'string') {
    return error;
  }
  
  // Fallback to default message
  return fallbackMessage;
};

/**
 * Checks if an error is a validation error (422 status)
 * @param error - The error object
 * @returns true if it's a validation error
 */
export const isValidationError = (error: unknown): boolean => {
  if (error && typeof error === 'object' && 'response' in error) {
    const axiosError = error as AxiosError;
    return axiosError.response?.status === 422;
  }
  return false;
};

/**
 * Checks if an error is a network error
 * @param error - The error object
 * @returns true if it's a network error
 */
export const isNetworkError = (error: unknown): boolean => {
  if (error && typeof error === 'object' && 'response' in error) {
    const axiosError = error as AxiosError;
    return axiosError.code === 'NETWORK_ERROR' || 
           axiosError.message.includes('Network Error') ||
           axiosError.code === 'ECONNABORTED';
  }
  return false;
};
