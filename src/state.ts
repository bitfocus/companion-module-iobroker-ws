import type { FeedbackId } from './feedback.js'

export class EntitySubscriptions {
	private readonly raiseSubscriptionsChanged: () => Promise<void> | undefined

	private readonly data: Map<string, Map<string, FeedbackId>>

	constructor(raiseSubscriptionsChanged: () => Promise<void> | undefined) {
		this.raiseSubscriptionsChanged = raiseSubscriptionsChanged

		this.data = new Map()
	}

	public getFeedbackInstanceIds(entityId: string): string[] {
		const entries = this.data.get(entityId)
		if (entries) {
			return Array.from(entries.keys())
		} else {
			return []
		}
	}

	public getEntityIds(): string[] {
		return Array.from(this.data.keys())
	}

	public subscribe(entityId: string, feedbackId: string, type: FeedbackId): void {
		let entries = this.data.get(entityId)
		if (!entries) {
			entries = new Map()
			this.data.set(entityId, entries)
		}
		entries.set(feedbackId, type)

		void this.raiseSubscriptionsChanged()
	}
	public unsubscribe(entityId: string, feedbackId: string): void {
		const entries = this.data.get(entityId)
		if (entries) {
			entries.delete(feedbackId)
		}

		void this.raiseSubscriptionsChanged()
	}

	public clear(): void {
		this.data.clear()

		void this.raiseSubscriptionsChanged()
	}
}
