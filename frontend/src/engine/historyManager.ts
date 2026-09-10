import { StemType, StemState, FxRackState, AudioClip, AutomationPoint } from '../types';

export interface HistoryStatePayload {
  stems: Record<StemType, StemState>;
  fxRack: FxRackState;
  clips: AudioClip[];
  automationPoints: AutomationPoint[];
  masterVolume: number;
  djFilterCutoff: number;
  djFilterType: 'lowpass' | 'highpass';
}

export interface HistoryEntry {
  id: string;
  description: string;
  timestamp: number;
  state: HistoryStatePayload;
}

/**
 * Deep clone utility for history snapshots to prevent mutational leakage
 */
function cloneState(state: HistoryStatePayload): HistoryStatePayload {
  return JSON.parse(JSON.stringify(state));
}

/**
 * Professional DAW Undo/Redo Engine
 * Manages timeline clips, mixer faders, FX racks, and Adobe keyframes
 */
export class HistoryManager {
  private undoStack: HistoryEntry[] = [];
  private redoStack: HistoryEntry[] = [];
  private currentState: HistoryEntry | null = null;
  private maxHistory: number = 50;

  constructor(initialState?: HistoryStatePayload, maxHistory = 50) {
    this.maxHistory = maxHistory;
    if (initialState) {
      this.init(initialState);
    }
  }

  /**
   * Initializes or resets the base state
   */
  public init(initialState: HistoryStatePayload): void {
    this.undoStack = [];
    this.redoStack = [];
    this.currentState = {
      id: `init_${Date.now()}`,
      description: 'Initial State',
      timestamp: Date.now(),
      state: cloneState(initialState),
    };
  }

  /**
   * Record a new user action to the undo stack
   */
  public pushState(description: string, newState: HistoryStatePayload): void {
    if (this.currentState) {
      this.undoStack.push(this.currentState);
      if (this.undoStack.length > this.maxHistory) {
        this.undoStack.shift(); // Evict oldest
      }
    }

    this.currentState = {
      id: `action_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      description,
      timestamp: Date.now(),
      state: cloneState(newState),
    };

    // Redo history is invalidated upon a new action
    this.redoStack = [];
  }

  /**
   * Reverts to the previous state
   */
  public undo(): HistoryEntry | null {
    if (!this.canUndo() || !this.currentState) {
      return null;
    }

    const previousEntry = this.undoStack.pop()!;
    this.redoStack.push(this.currentState);
    this.currentState = previousEntry;

    return {
      ...this.currentState,
      state: cloneState(this.currentState.state),
    };
  }

  /**
   * Reapplies the previously undone state
   */
  public redo(): HistoryEntry | null {
    if (!this.canRedo() || !this.currentState) {
      return null;
    }

    const nextEntry = this.redoStack.pop()!;
    this.undoStack.push(this.currentState);
    this.currentState = nextEntry;

    return {
      ...this.currentState,
      state: cloneState(this.currentState.state),
    };
  }

  public canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  public canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  public getUndoDescription(): string | null {
    if (!this.canUndo()) return null;
    return this.undoStack[this.undoStack.length - 1].description;
  }

  public getRedoDescription(): string | null {
    if (!this.canRedo()) return null;
    return this.redoStack[this.redoStack.length - 1].description;
  }

  public getCurrentState(): HistoryStatePayload | null {
    return this.currentState ? cloneState(this.currentState.state) : null;
  }

  public getStackCounts(): { undoCount: number; redoCount: number } {
    return {
      undoCount: this.undoStack.length,
      redoCount: this.redoStack.length,
    };
  }

  public clear(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.currentState = null;
  }
}
