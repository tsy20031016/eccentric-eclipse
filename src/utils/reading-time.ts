/**
 * 估算阅读时长（分钟）。
 * 中文按每分钟 400 字，英文按每分钟 200 词计算。
 */
export function readingTime(text: string): number {
	const cjk = (text.match(/[\u3400-\u4dbf\u4e00-\u9fff]/g) ?? []).length;
	const words = (
		text
			.replace(/[\u3400-\u4dbf\u4e00-\u9fff]/g, " ")
			.match(/[A-Za-z0-9_'’-]+/g) ?? []
	).length;

	const minutes = cjk / 400 + words / 200;
	return Math.max(1, Math.round(minutes));
}
