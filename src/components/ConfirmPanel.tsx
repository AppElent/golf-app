import { type RefObject, useEffect, useId, useRef } from "react";

/** The web's confirmation for a destructive action, shown in place under its
 *  trigger instead of a browser `window.confirm` (web-design.md). Cancel gets
 *  focus when it opens; when it closes, focus goes back to `returnFocusTo`
 *  (the trigger), unless the golfer already moved it elsewhere. Without
 *  `onConfirm` it only asks a question: `children` hold the choices. */
export function ConfirmPanel({
	title,
	description,
	children,
	confirmLabel,
	onConfirm,
	onCancel,
	cancelLabel = "Cancel",
	disabled = false,
	error,
	returnFocusTo,
	className = "",
}: {
	title: string;
	description?: React.ReactNode;
	children?: React.ReactNode;
	confirmLabel?: string;
	onConfirm?: () => void;
	onCancel: () => void;
	cancelLabel?: string;
	disabled?: boolean;
	/** A failure to show inside the panel, announced as an alert. */
	error?: string | null;
	returnFocusTo?: RefObject<HTMLElement | null>;
	className?: string;
}) {
	const titleId = useId();
	const descriptionId = useId();
	const panel = useRef<HTMLElement>(null);
	const cancel = useRef<HTMLButtonElement>(null);

	useEffect(() => {
		cancel.current?.focus();
		const container = panel.current;
		return () => {
			const active = document.activeElement;
			// Only take focus back from the panel itself, or from nowhere (the
			// focused button was just removed with it).
			if (
				active === null ||
				active === document.body ||
				container?.contains(active)
			) {
				returnFocusTo?.current?.focus();
			}
		};
	}, [returnFocusTo]);

	return (
		<section
			ref={panel}
			aria-labelledby={titleId}
			aria-describedby={description ? descriptionId : undefined}
			className={`rounded-2xl border border-flag/40 bg-flag/5 p-4 ${className}`}
		>
			<p id={titleId} className="text-label font-semibold text-ink">
				{title}
			</p>
			{description ? (
				<p id={descriptionId} className="mt-1 text-label text-moss">
					{description}
				</p>
			) : null}
			{children ? (
				<div className="mt-3 flex flex-col gap-2">{children}</div>
			) : null}
			<div className={`${children ? "mt-2" : "mt-3"} flex gap-2`}>
				{onConfirm && confirmLabel ? (
					<button
						type="button"
						disabled={disabled}
						onClick={onConfirm}
						className="flex-1 rounded-full bg-flag px-4 py-3 font-display text-callout font-bold text-white disabled:opacity-40"
					>
						{confirmLabel}
					</button>
				) : null}
				<button
					ref={cancel}
					type="button"
					disabled={disabled}
					onClick={onCancel}
					className={`${onConfirm ? "" : "flex-1 "}rounded-full border border-control-line px-4 py-3 font-display text-callout font-semibold text-ink disabled:opacity-40`}
				>
					{cancelLabel}
				</button>
			</div>
			{error ? (
				<p role="alert" className="mt-2 text-label font-semibold text-flag-ink">
					{error}
				</p>
			) : null}
		</section>
	);
}
