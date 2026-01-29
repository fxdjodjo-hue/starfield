/**
 * Network message types for client-server communication
 */

/**
 * Base network message type
 * All messages have at least a 'type' field
 */
export interface NetMessage {
    type: string;
    [key: string]: any;
}
