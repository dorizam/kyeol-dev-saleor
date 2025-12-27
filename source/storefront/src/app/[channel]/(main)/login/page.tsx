import { Suspense } from "react";
import { Loader } from "@/ui/atoms/Loader";
import { LoginForm } from "@/ui/components/LoginForm";

export default async function LoginPage({
	params,
}: {
	params: Promise<{ channel: string }>;
}) {
	const { channel } = await params;
	return (
		<Suspense fallback={<Loader />}>
			<section className="mx-auto max-w-7xl p-8">
				<LoginForm channel={channel} />
			</section>
		</Suspense>
	);
}

