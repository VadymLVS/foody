import { useState } from 'react';
import { Modal, Button, Input } from '@/shared/ui';

interface Props {
  open: boolean;
  currentName: string;
  onSave: (name: string) => void;
  onClose: () => void;
}

export function RenameProductModal({ open, currentName, onSave, onClose }: Props) {
  const [name, setName] = useState(currentName);

  return (
    <Modal
      open={open}
      title="Переименовать"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" fullWidth onClick={onClose}>
            Отмена
          </Button>
          <Button
            fullWidth
            disabled={!name.trim() || name === currentName}
            onClick={() => {
              onSave(name.trim());
              onClose();
            }}
          >
            Сохранить
          </Button>
        </>
      }
    >
      <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
    </Modal>
  );
}
