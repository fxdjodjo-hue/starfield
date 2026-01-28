import type { QuestObjective, QuestReward } from '../../presentation/ui/QuestPanel';

/**
 * Componente Quest - Rappresenta una singola quest nel sistema ECS
 */
export class Quest {
  public id: string;
  public title: string;
  public description: string;
  public type: 'kill' | 'survival' | 'progression' | 'collection' | 'achievement' | 'exploration';
  public objectives: QuestObjective[];
  public rewards: QuestReward[];
  public isActive: boolean;
  public isCompleted: boolean;

  constructor(
    id: string,
    title: string,
    description: string,
    type: 'kill' | 'survival' | 'progression' | 'collection' | 'achievement' | 'exploration',
    objectives: QuestObjective[],
    rewards: QuestReward[],
    isActive: boolean = false,
    isCompleted: boolean = false
  ) {
    this.id = id;
    this.title = title;
    this.description = description;
    this.type = type;
    this.objectives = objectives;
    this.rewards = rewards;
    this.isActive = isActive;
    this.isCompleted = isCompleted;
  }

  /**
   * Calcola il progresso totale della quest (0-100)
   */
  getProgress(): number {
    if (this.objectives.length === 0) return 100;

    const totalProgress = this.objectives.reduce((sum, obj) => {
      return sum + Math.min((obj.current / obj.target) * 100, 100);
    }, 0);

    return Math.round(totalProgress / this.objectives.length);
  }

  /**
   * Verifica se la quest è completata
   */
  checkCompletion(): boolean {
    return this.objectives.every(obj => obj.current >= obj.target);
  }

  /**
   * Resetta il progresso della quest (per riaccettarla dopo abbandono)
   */
  resetProgress(): void {
    this.isCompleted = false;
    this.objectives.forEach(objective => {
      objective.current = 0;
    });
  }

  /**
   * Aggiorna un obiettivo specifico e restituisce quanto della quantità fornita è stata consumata.
   */
  updateObjective(objectiveId: string, amount: number = 1): { completed: boolean, consumed: number } {
    const objective = this.objectives.find(obj => obj.id === objectiveId);
    if (!objective || this.isCompleted) return { completed: false, consumed: 0 };

    const needed = objective.target - objective.current;
    if (needed <= 0) return { completed: false, consumed: 0 };

    const consumed = Math.min(amount, needed);
    objective.current += consumed;

    const isQuestCompleted = this.checkCompletion();
    if (isQuestCompleted) {
      this.isCompleted = true;
    }

    return { completed: isQuestCompleted, consumed };
  }
}
