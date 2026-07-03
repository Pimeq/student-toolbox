interface Measurement {
	test: string
	result: string
}

const measurements: Measurement[] = []

export function record(test: string, result: string): void {
	measurements.push({ test, result })
	console.log(`  [niefunkcjonalny] ${test}: ${result}`)
}

export async function measure<T>(fn: () => Promise<T>): Promise<{ value: T; ms: number }> {
	const start = performance.now()
	const value = await fn()
	const ms = Math.round(performance.now() - start)
	return { value, ms }
}

export function printReportTable(): void {
	if (!measurements.length) return

	const testColWidth = Math.max(4, ...measurements.map((m) => m.test.length))
	const resultColWidth = Math.max(6, ...measurements.map((m) => m.result.length))
	const line = `+${"-".repeat(testColWidth + 2)}+${"-".repeat(resultColWidth + 2)}+`
	const row = (a: string, b: string) => `| ${a.padEnd(testColWidth)} | ${b.padEnd(resultColWidth)} |`

	console.log("\nTabela III. Wyniki testów niefunkcjonalnych")
	console.log(line)
	console.log(row("Test", "Wynik"))
	console.log(line)
	for (const m of measurements) console.log(row(m.test, m.result))
	console.log(line)
}
