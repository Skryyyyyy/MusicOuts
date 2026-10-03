import { Project, Clip, Track, Fade } from './types';

export interface Command {
  id: string;
  name: string;
  timestamp: number;
  execute(project: Project): Project;
  undo(project: Project): Project;
}

export class CommandManager {
  private history: Command[] = [];
  private redoStack: Command[] = [];
  private maxHistory: number = 100;
  private listeners: ((canUndo: boolean, canRedo: boolean) => void)[] = [];

  constructor(maxHistory: number = 100) {
    this.maxHistory = maxHistory;
  }

  public execute(command: Command, project: Project): Project {
    const updatedProject = command.execute(project);
    this.history.push(command);
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }
    this.redoStack = []; // Clear redo stack on new action
    this.notifyListeners();
    return updatedProject;
  }

  public undo(project: Project): Project {
    if (!this.canUndo()) return project;
    const command = this.history.pop()!;
    const updatedProject = command.undo(project);
    this.redoStack.push(command);
    this.notifyListeners();
    return updatedProject;
  }

  public redo(project: Project): Project {
    if (!this.canRedo()) return project;
    const command = this.redoStack.pop()!;
    const updatedProject = command.execute(project);
    this.history.push(command);
    this.notifyListeners();
    return updatedProject;
  }

  public canUndo(): boolean {
    return this.history.length > 0;
  }

  public canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  public getHistoryNames(): string[] {
    return this.history.map((c) => c.name);
  }

  public subscribe(listener: (canUndo: boolean, canRedo: boolean) => void): () => void {
    this.listeners.push(listener);
    listener(this.canUndo(), this.canRedo());
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach((l) => l(this.canUndo(), this.canRedo()));
  }
}

// ----------------------------------------------------------------------
// Concrete Non-Destructive Commands
// ----------------------------------------------------------------------

/**
 * Split Clip Command: Non-destructively cuts a clip at splitTime into two clips.
 */
export class SplitClipCommand implements Command {
  id = crypto.randomUUID();
  name = 'Split Clip';
  timestamp = Date.now();

  private originalClip: Clip;
  private leftClip: Clip | null = null;
  private rightClip: Clip | null = null;

  constructor(private clipId: string, private splitTimelineTime: number) {
    this.originalClip = {} as Clip; // Populated on execute
  }

  execute(project: Project): Project {
    const clipIndex = project.clips.findIndex((c) => c.id === this.clipId);
    if (clipIndex === -1) return project;

    const clip = project.clips[clipIndex];
    this.originalClip = { ...clip };

    const offsetInClip = this.splitTimelineTime - clip.startTime;
    const clipDuration = clip.sourceOut - clip.sourceIn;

    // Boundary check: split must be strictly within clip
    if (offsetInClip <= 0.01 || offsetInClip >= clipDuration - 0.01) {
      return project;
    }

    const splitSourcePoint = clip.sourceIn + offsetInClip;

    this.leftClip = {
      ...clip,
      id: `${clip.id}-L-${Date.now()}`,
      name: `${clip.name} (Part 1)`,
      sourceOut: splitSourcePoint,
    };

    this.rightClip = {
      ...clip,
      id: `${clip.id}-R-${Date.now()}`,
      name: `${clip.name} (Part 2)`,
      sourceIn: splitSourcePoint,
      startTime: this.splitTimelineTime,
    };

    const newClips = [...project.clips];
    newClips.splice(clipIndex, 1, this.leftClip, this.rightClip);

    return {
      ...project,
      clips: newClips,
      updatedAt: new Date().toISOString(),
    };
  }

  undo(project: Project): Project {
    if (!this.leftClip || !this.rightClip) return project;

    const leftIdx = project.clips.findIndex((c) => c.id === this.leftClip!.id);

    if (leftIdx === -1) return project;

    const newClips = project.clips.filter(
      (c) => c.id !== this.leftClip!.id && c.id !== this.rightClip!.id
    );
    newClips.splice(leftIdx, 0, this.originalClip);

    return {
      ...project,
      clips: newClips,
      updatedAt: new Date().toISOString(),
    };
  }
}

/**
 * Move/Slip Clip Command: Updates startTime or trackId
 */
export class MoveClipCommand implements Command {
  id = crypto.randomUUID();
  name = 'Move Clip';
  timestamp = Date.now();

  private previousStartTime: number = 0;
  private previousTrackId: string = '';

  constructor(
    private clipId: string,
    private newStartTime: number,
    private newTrackId?: string
  ) {}

  execute(project: Project): Project {
    const clip = project.clips.find((c) => c.id === this.clipId);
    if (!clip) return project;

    this.previousStartTime = clip.startTime;
    this.previousTrackId = clip.trackId;

    return {
      ...project,
      clips: project.clips.map((c) =>
        c.id === this.clipId
          ? {
              ...c,
              startTime: Math.max(0, this.newStartTime),
              trackId: this.newTrackId ?? c.trackId,
            }
          : c
      ),
      updatedAt: new Date().toISOString(),
    };
  }

  undo(project: Project): Project {
    return {
      ...project,
      clips: project.clips.map((c) =>
        c.id === this.clipId
          ? {
              ...c,
              startTime: this.previousStartTime,
              trackId: this.previousTrackId,
            }
          : c
      ),
      updatedAt: new Date().toISOString(),
    };
  }
}

/**
 * Trim Clip Command: Non-destructive in/out boundary adjustment
 */
export class TrimClipCommand implements Command {
  id = crypto.randomUUID();
  name = 'Trim Clip';
  timestamp = Date.now();

  private prevSourceIn: number = 0;
  private prevSourceOut: number = 0;
  private prevStartTime: number = 0;

  constructor(
    private clipId: string,
    private newSourceIn: number,
    private newSourceOut: number,
    private newStartTime?: number
  ) {}

  execute(project: Project): Project {
    const clip = project.clips.find((c) => c.id === this.clipId);
    if (!clip) return project;

    this.prevSourceIn = clip.sourceIn;
    this.prevSourceOut = clip.sourceOut;
    this.prevStartTime = clip.startTime;

    return {
      ...project,
      clips: project.clips.map((c) =>
        c.id === this.clipId
          ? {
              ...c,
              sourceIn: Math.max(0, this.newSourceIn),
              sourceOut: Math.max(this.newSourceIn + 0.05, this.newSourceOut),
              startTime: this.newStartTime !== undefined ? Math.max(0, this.newStartTime) : c.startTime,
            }
          : c
      ),
      updatedAt: new Date().toISOString(),
    };
  }

  undo(project: Project): Project {
    return {
      ...project,
      clips: project.clips.map((c) =>
        c.id === this.clipId
          ? {
              ...c,
              sourceIn: this.prevSourceIn,
              sourceOut: this.prevSourceOut,
              startTime: this.prevStartTime,
            }
          : c
      ),
      updatedAt: new Date().toISOString(),
    };
  }
}

/**
 * Set Clip Fade Command
 */
export class SetClipFadeCommand implements Command {
  id = crypto.randomUUID();
  name = 'Set Fade';
  timestamp = Date.now();

  private prevFadeIn?: Fade;
  private prevFadeOut?: Fade;

  constructor(
    private clipId: string,
    private fadeIn?: Fade,
    private fadeOut?: Fade
  ) {}

  execute(project: Project): Project {
    const clip = project.clips.find((c) => c.id === this.clipId);
    if (!clip) return project;

    this.prevFadeIn = clip.fadeIn;
    this.prevFadeOut = clip.fadeOut;

    return {
      ...project,
      clips: project.clips.map((c) =>
        c.id === this.clipId
          ? {
              ...c,
              fadeIn: this.fadeIn ?? c.fadeIn,
              fadeOut: this.fadeOut ?? c.fadeOut,
            }
          : c
      ),
      updatedAt: new Date().toISOString(),
    };
  }

  undo(project: Project): Project {
    return {
      ...project,
      clips: project.clips.map((c) =>
        c.id === this.clipId
          ? {
              ...c,
              fadeIn: this.prevFadeIn,
              fadeOut: this.prevFadeOut,
            }
          : c
      ),
      updatedAt: new Date().toISOString(),
    };
  }
}

/**
 * Add / Delete Track Commands
 */
export class AddTrackCommand implements Command {
  id = crypto.randomUUID();
  name = 'Add Track';
  timestamp = Date.now();

  constructor(private track: Track) {}

  execute(project: Project): Project {
    return {
      ...project,
      tracks: [...project.tracks, this.track],
      updatedAt: new Date().toISOString(),
    };
  }

  undo(project: Project): Project {
    return {
      ...project,
      tracks: project.tracks.filter((t) => t.id !== this.track.id),
      updatedAt: new Date().toISOString(),
    };
  }
}

/**
 * Ripple Delete Clip Command: Deletes clip and shifts subsequent clips left by clip duration.
 */
export class RippleDeleteClipCommand implements Command {
  id = crypto.randomUUID();
  name = 'Ripple Delete Clip';
  timestamp = Date.now();

  private deletedClip: Clip | null = null;
  private deletedClipIndex: number = -1;
  private shiftedClips: { id: string; oldStartTime: number }[] = [];

  constructor(private clipId: string) {}

  execute(project: Project): Project {
    const clipIdx = project.clips.findIndex((c) => c.id === this.clipId);
    if (clipIdx === -1) return project;

    const clip = project.clips[clipIdx];
    this.deletedClip = { ...clip };
    this.deletedClipIndex = clipIdx;

    const clipDuration = clip.sourceOut - clip.sourceIn;
    const clipEnd = clip.startTime + clipDuration;

    this.shiftedClips = [];

    // Filter out deleted clip and shift following clips on same track
    const newClips = project.clips
      .filter((c) => c.id !== this.clipId)
      .map((c) => {
        if (c.trackId === clip.trackId && c.startTime >= clipEnd - 0.001) {
          this.shiftedClips.push({ id: c.id, oldStartTime: c.startTime });
          return {
            ...c,
            startTime: Math.max(0, c.startTime - clipDuration),
          };
        }
        return c;
      });

    return {
      ...project,
      clips: newClips,
      updatedAt: new Date().toISOString(),
    };
  }

  undo(project: Project): Project {
    if (!this.deletedClip) return project;

    // Restore shifted positions
    const restoredClips = project.clips.map((c) => {
      const shiftRecord = this.shiftedClips.find((s) => s.id === c.id);
      if (shiftRecord) {
        return {
          ...c,
          startTime: shiftRecord.oldStartTime,
        };
      }
      return c;
    });

    // Reinsert deleted clip
    restoredClips.splice(this.deletedClipIndex, 0, this.deletedClip);

    return {
      ...project,
      clips: restoredClips,
      updatedAt: new Date().toISOString(),
    };
  }
}

