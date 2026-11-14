import { useEditor } from '../store';

export function useNotice() {
  const notice = useEditor((s) => s.notice);
  const setNotice = useEditor((s) => s.setNotice);
  return { notice, dismiss: () => setNotice(null) };
}
