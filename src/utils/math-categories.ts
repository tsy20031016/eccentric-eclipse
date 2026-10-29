export const mathSubjects = [
	{ name: "数学分析", id: "analysis", description: "极限、微分、积分，以及分析中的基础问题。", topics: [
		{ name: "极限", id: "limits" },
		{ name: "导数", id: "derivatives" },
		{ name: "积分", id: "integrals" },
	] },
	{ name: "高等代数", id: "algebra", description: "多项式、线性空间与线性变换的学习记录。", topics: [] },
];

export function getMathSubject(tags: string[]) {
	return tags.includes("高等代数") ? "高等代数" : "数学分析";
}
