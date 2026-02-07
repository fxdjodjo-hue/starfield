/**
 * Network message types for client-server communication
 */

/**
 * Base network message type
 * All messages have at least a 'type' field
 */
export interface NetMessage {
    type: string;
    clientId?: string;
    [key: string]: any;
}

export interface ChatMessage extends NetMessage {
    playerId?: string;
    senderName?: string;
    content: string;
    timestamp: number;
    isAdministrator?: boolean;
}
