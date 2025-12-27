/** @type {import('next').NextConfig} */
const config = {
	images: {
		remotePatterns: [
			{
				hostname: "*",
			},
		],
	},
	typedRoutes: false,
	// used in the Dockerfile
	output:
		process.env.NEXT_OUTPUT === "standalone"
			? "standalone"
			: process.env.NEXT_OUTPUT === "export"
				? "export"
				: undefined,
	// 루트 경로 접속 시 default-channel로 리다이렉트
	async redirects() {
		return [
			{
				source: "/",
				destination: "/default-channel",
				permanent: true, // 301 리다이렉트 (SEO에 유리)
			},
		];
	},
};

export default config;
