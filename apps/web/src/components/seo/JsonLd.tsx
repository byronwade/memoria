interface JsonLdProps {
	schema: Record<string, unknown> | Record<string, unknown>[];
}

export function JsonLd({ schema }: JsonLdProps) {
	const schemas = Array.isArray(schema) ? schema : [schema];

	return (
		<>
			{schemas.map((s, index) => (
				<script
					key={index}
					type="application/ld+json"
					dangerouslySetInnerHTML={{ __html: JSON.stringify(s) }}
				/>
			))}
		</>
	);
}
