/**
 * What can happen to one of the account's email addresses, each confirmed
 * first and saved to Clerk: make a verified address primary (then offer to
 * remove the old primary, which together is "change my email"), remove a
 * non-primary address, and send a code to verify one.
 *
 * The primary address is the one people sign in with, so it is never removed
 * here: another address becomes primary first.
 */
import { useUser } from "@clerk/expo";
import { useRouter } from "expo-router";
import { fmt, useI18n } from "../../../i18n";
import { useConfirm } from "../../../ui/confirm-dialog";
import { useToast } from "../../../ui/toast";
import { thrownErrorKey } from "../../auth/clerk-errors";
import { useClerkWrite } from "./use-clerk-write";

export function useEmailActions() {
	const { user } = useUser();
	const { t } = useI18n();
	const copy = t.account;
	const confirm = useConfirm();
	const toast = useToast();
	const router = useRouter();
	const write = useClerkWrite();

	const find = (id: string) => user?.emailAddresses.find((a) => a.id === id);

	/** `useClerkWrite` keeps `error` only without `onError`; these report by toast. */
	const fail = () => (failure: unknown) =>
		toast.error(t.authErrors[thrownErrorKey(failure)]);

	/** Asks, then removes a non-primary address. True once it is gone. */
	async function remove(id: string, intro?: "old"): Promise<boolean> {
		const address = find(id);
		if (!address || address.id === user?.primaryEmailAddressId) return false;
		const email = address.emailAddress;
		const ok = await confirm({
			title: fmt(intro === "old" ? copy.removeOldTitle : copy.removeTitle, {
				email,
			}),
			message: copy.removeOldMessage,
			confirmLabel: copy.remove,
			destructive: true,
		});
		if (!ok) return false;
		return write.run(
			async () => {
				await address.destroy();
				await user?.reload();
			},
			{
				stay: true,
				onError: fail(),
				onSuccess: () => toast.success(fmt(copy.removed, { email })),
			},
		);
	}

	/**
	 * Asks, then makes a verified address primary, then offers to remove the
	 * address that was primary before.
	 */
	async function makePrimary(id: string): Promise<void> {
		const address = find(id);
		if (!user || !address) return;
		const email = address.emailAddress;
		const previous = user.primaryEmailAddressId;
		const ok = await confirm({
			title: fmt(copy.makePrimaryTitle, { email }),
			message: copy.makePrimaryMessage,
			confirmLabel: copy.makePrimary,
		});
		if (!ok) return;
		const changed = await write.run(
			() => user.update({ primaryEmailAddressId: id }),
			{
				stay: true,
				onError: fail(),
				onSuccess: () => toast.success(fmt(copy.primaryChanged, { email })),
			},
		);
		if (changed && previous && previous !== id && write.isOpen()) {
			await remove(previous, "old");
		}
	}

	/** Sends a fresh code to an unverified address and opens its code step. */
	async function verify(id: string): Promise<void> {
		const address = find(id);
		if (!address) return;
		await write.run(
			() => address.prepareVerification({ strategy: "email_code" }),
			{
				stay: true,
				onError: fail(),
				onSuccess: () =>
					router.push({ pathname: "/profile/verify-email", params: { id } }),
			},
		);
	}

	return { remove, makePrimary, verify, pending: write.pending };
}
