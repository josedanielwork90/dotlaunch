import React, { useEffect, useState } from "react";
import styled from "styled-components";

import { AppModal } from "../../common/AppModal";
import { ModalContent } from "../../common/AppModal/ModalContent";
import { ModalHeader } from "../../common/AppModal/ModalHeader";
import { Spinner } from "../../common/Spinner";
import { shortenAddress } from "../../../utils";
import walletManager, { DemoAccount } from "../../../services/wallet";
import { runtimeConfig } from "../../../utils/runtimeConfig";
import { errorMessage } from "../../../utils/errors";

/**
 * Account picker for the built-in demo wallet.
 *
 * The app is wallet-gated, so without an extension there is no way in. This
 * dialog lists the local chain's pre-funded accounts with the role each one
 * plays in the seeded data, so someone opening the app for the first time
 * can pick "Founder" and immediately see a populated dashboard rather than
 * an empty one.
 */

interface AccountRowProps {
  active?: boolean;
}

const AccountRow = styled.button.attrs<AccountRowProps>(() => ({
  className: `w-full flex items-center justify-between text-left py-3 px-4 my-2 rounded-lg`,
}))<AccountRowProps>`
  transition: all 0.2s ease;
  border: 1px solid
    ${(props) =>
      props.active ? props.theme.colors.primaryRed : props.theme.colors.outline};
  background: ${(props) =>
    props.active ? props.theme.colors.secondaryRed : "transparent"};

  &:hover {
    border-color: ${(props) => props.theme.colors.primaryRed};
    box-shadow: 0 6px 14px hsl(0deg 0% 39% / 12%);
  }

  &:focus-visible {
    outline: 2px solid ${(props) => props.theme.colors.primaryRed};
    outline-offset: 2px;
  }
`;

const RoleLabel = styled.span`
  font-weight: 700;
  display: block;
`;

const RoleDescription = styled.span`
  display: block;
  font-size: 0.8rem;
  opacity: 0.7;
`;

const AddressText = styled.span`
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.78rem;
  opacity: 0.75;
  white-space: nowrap;
`;

const Notice = styled.div.attrs(() => ({
  className: `text-sm rounded-lg py-3 px-4 mb-2`,
}))`
  background: ${(props) => props.theme.colors.secondaryBackground};
  border: 1px solid ${(props) => props.theme.colors.outline};
`;

const ErrorNotice = styled(Notice)`
  border-color: ${(props) => props.theme.colors.primaryRed};
  background: ${(props) => props.theme.colors.secondaryRed};
`;

export interface DemoWalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called with the selected address once the wallet is connected. */
  onConnected: (address: string) => void;
  /** Currently active address, highlighted in the list. */
  currentAddress?: string;
}

export const DemoWalletModal = ({
  isOpen,
  onClose,
  onConnected,
  currentAddress,
}: DemoWalletModalProps) => {
  const [accounts, setAccounts] = useState<DemoAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [connecting, setConnecting] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    // Only reach for the chain while the dialog is actually open, and drop
    // the result if it closes first - otherwise a slow RPC call sets state
    // on an unmounted component.
    if (!isOpen) return undefined;

    let cancelled = false;
    setLoading(true);
    setError("");

    walletManager
      .demoAccounts()
      .then((list) => {
        if (cancelled) return;
        setAccounts(list);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(
          errorMessage(
            err,
            `Could not reach the development chain at ${runtimeConfig.chainRpcUrl}.`
          )
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const handleSelect = async (address: string) => {
    setConnecting(address);
    setError("");
    try {
      const connected = await walletManager.connect("DEMO", { address });
      onConnected(connected);
      onClose();
    } catch (err) {
      setError(errorMessage(err, "Could not connect."));
    } finally {
      setConnecting("");
    }
  };

  return (
    <AppModal modalIsOpen={isOpen} closeModal={onClose}>
      <ModalHeader text="Choose a demo account" onModalClose={onClose} />
      <ModalContent>
        <Notice>
          These accounts live on the local development chain and are pre-funded
          with {runtimeConfig.nativeSymbol}. Nothing here touches a real
          network, and no private key is held by the browser — the node signs.
        </Notice>

        {error ? <ErrorNotice>{error}</ErrorNotice> : null}

        {loading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : null}

        {!loading && accounts.length === 0 && !error ? (
          <Notice>
            The development chain reported no accounts. Check that it is
            running at {runtimeConfig.chainRpcUrl}.
          </Notice>
        ) : null}

        {accounts.map((account) => {
          const active =
            Boolean(currentAddress) &&
            account.address.toLowerCase() === (currentAddress || "").toLowerCase();

          return (
            <AccountRow
              key={account.address}
              active={active}
              disabled={Boolean(connecting)}
              onClick={() => handleSelect(account.address)}
            >
              <span>
                <RoleLabel>
                  {account.label}
                  {active ? " · connected" : ""}
                </RoleLabel>
                <RoleDescription>{account.description}</RoleDescription>
              </span>
              <AddressText>
                {connecting === account.address
                  ? "connecting…"
                  : shortenAddress(account.address)}
              </AddressText>
            </AccountRow>
          );
        })}
      </ModalContent>
    </AppModal>
  );
};

export default DemoWalletModal;
