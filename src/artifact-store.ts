import type { ContextArtifact } from './types.js'

export class ContextArtifactStore {
  private artifacts = new Map<string, ContextArtifact>()

  put(artifact: ContextArtifact): void {
    this.artifacts.set(artifact.id, artifact)
  }

  get(id: string): ContextArtifact | undefined {
    return this.artifacts.get(id)
  }

  has(id: string): boolean {
    return this.artifacts.has(id)
  }

  list(): ContextArtifact[] {
    return [...this.artifacts.values()]
  }
}
