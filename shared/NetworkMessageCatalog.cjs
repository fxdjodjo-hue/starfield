// NetworkMessageCatalog - authoritative client/server message catalog
// Use this as the single source of truth for inbound client message types.

const CLIENT_TO_SERVER_MESSAGE_TYPES = Object.freeze([
  'join',
  'position_update',
  'heartbeat',
  'projectile_fired',
  'start_combat',
  'stop_combat',
  'request_player_data',
  'chat_message',
  'save_request',
  'player_respawn_request',
  'global_monitor_request',
  'skill_upgrade_request',
  'request_leaderboard',
  'equip_item',
  'portal_use',
  'quest_progress_update',
  'quest_accept',
  'quest_abandon',

  // Legacy typo kept only for backward compatibility checks.
  'equp_item'
]);

function isClientToServerMessageType(type) {
  return CLIENT_TO_SERVER_MESSAGE_TYPES.includes(type);
}

module.exports = {
  CLIENT_TO_SERVER_MESSAGE_TYPES,
  isClientToServerMessageType
};
