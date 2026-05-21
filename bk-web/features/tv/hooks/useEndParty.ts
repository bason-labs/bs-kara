'use client';

import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTransientNotice } from '@bs-kara/shared/hooks';

// End-Party flow: confirm-dialog gate → resetRoom → 5s "party ended"
// toast. The TV stays attached to its room (see useTVPresence) so a fresh
// round can start without re-claiming a code.
export function useEndParty(resetRoom: () => Promise<void>) {
  const { t } = useTranslation();
  const [endConfirmOpen, setEndConfirmOpen] = useState(false);
  const { notice: endNotice, show: showEndNotice } = useTransientNotice(5000);

  const openEndConfirm = useCallback(() => setEndConfirmOpen(true), []);
  const closeEndConfirm = useCallback(() => setEndConfirmOpen(false), []);

  // Closes the confirm and runs the soft reset; the toast surfaces the
  // outcome to anyone in front of the TV.
  const confirmEndParty = useCallback(async () => {
    setEndConfirmOpen(false);
    await resetRoom();
    showEndNotice(t('tv.endPartyNotice'));
  }, [resetRoom, showEndNotice, t]);

  return {
    endConfirmOpen,
    openEndConfirm,
    closeEndConfirm,
    confirmEndParty,
    endNotice,
  };
}
