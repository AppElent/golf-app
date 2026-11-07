import { useEffect, useState } from "react";

/** Assumes online until mounted, so server and first client render agree. */
export function useOnlineStatus(): boolean {
	const [online, setOnline] = useState(true);

	useEffect(() => {
		const update = () => setOnline(navigator.onLine);
		update();
		window.addEventListener("online", update);
		window.addEventListener("offline", update);
		return () => {
			window.removeEventListener("online", update);
			window.removeEventListener("offline", update);
		};
	}, []);

	return online;
}
