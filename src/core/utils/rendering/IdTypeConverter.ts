import { type PlayerUuid, type PlayerDbId, type ClientId } from '../../../config/NetworkConfig';
import { type EntityId } from '../../../infrastructure/ecs/Entity';

/**
 * Utility per conversioni sicure tra tipi di ID
 *
 * IMPORTANTE: Usare solo ai layer di confine (network, persistence)
 * Evitare in hot paths ECS per non lanciare errori a runtime
 */
export class IdTypeConverter {
  /**
   * Converte string UUID a PlayerUuid branded type
   * @throws Error se UUID non valido
   */
  static toPlayerUuid(uuid: string): PlayerUuid {
    if (!uuid || typeof uuid !== 'string' || uuid.trim() === '') {
      throw new Error(`Invalid PlayerUuid: ${uuid}`);
    }
    return uuid as PlayerUuid;
  }

  /**
   * Converte number a PlayerDbId branded type
   * @throws Error se ID non valido
   */
  static toPlayerDbId(id: number): PlayerDbId {
    if (!id || id <= 0 || !Number.isInteger(id)) {
      throw new Error(`Invalid PlayerDbId: ${id}`);
    }
    return id as PlayerDbId;
  }

  /**
   * Converte string a ClientId branded type
   * @throws Error se ID non valido
   */
  static toClientId(id: string): ClientId {
    if (!id || typeof id !== 'string' || id.trim() === '') {
      throw new Error(`Invalid ClientId: ${id}`);
    }
    return id as ClientId;
  }

  /**
   * Converte number a EntityId branded type
   * @throws Error se ID non valido
   */
  static toEntityId(id: number): EntityId {
    if (id < 0 || !Number.isInteger(id)) {
      throw new Error(`Invalid EntityId: ${id}`);
    }
    return id as EntityId;
  }

  /**
   * Safe conversion: PlayerUuid to string (per serializzazione)
   */
  static playerUuidToString(uuid: PlayerUuid): string {
    return uuid as string;
  }

  /**
   * Safe conversion: PlayerDbId to number (per serializzazione)
   */
  static playerDbIdToNumber(id: PlayerDbId): number {
    return id as number;
  }
}
