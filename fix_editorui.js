const fs = require('fs');
let code = fs.readFileSync('app/ui/EditorUI.tsx', 'utf8');

code = code.replace(
  `  const handleBack = async () => {`,
  `  const handleBack = useCallback(async () => {`
).replace(
  `  const clickEngine = (sel: string) => {`,
  `  const clickEngine = useCallback((sel: string) => {`
).replace(
  `  const toggleEngine = (sel: string, setter: React.Dispatch<React.SetStateAction<boolean>>) => {`,
  `  const toggleEngine = useCallback((sel: string, setter: React.Dispatch<React.SetStateAction<boolean>>) => {`
).replace(
  `  const handleSetTool = (tool: 'draw' | 'erase' | 'select') => {`,
  `  const handleSetTool = useCallback((tool: 'draw' | 'erase' | 'select') => {`
).replace(
  `  const handleUndo = async () => {`,
  `  const handleUndo = useCallback(async () => {`
).replace(
  `  const handleRedo = async () => {`,
  `  const handleRedo = useCallback(async () => {`
).replace(
  `    if (confirmExit) {
      Alert.alert(tr.editor.exitConfirmTitle, tr.editor.exitConfirmMessage, [
        { text: tr.common.cancel, style: 'cancel' },
        { text: tr.editor.exitButton, style: 'destructive', onPress: () => leave() },
      ]);
    } else {
      await leave();
    }
  };`,
  `    if (confirmExit) {
      Alert.alert(tr.editor.exitConfirmTitle, tr.editor.exitConfirmMessage, [
        { text: tr.common.cancel, style: 'cancel' },
        { text: tr.editor.exitButton, style: 'destructive', onPress: () => leave() },
      ]);
    } else {
      await leave();
    }
  }, [confirmExit, onSave, tr]);`
).replace(
  `        }
      })()\`
    );
  };`,
  `        }
      })()\`
    );
  }, [webRef]);`
).replace(
  `    clickEngine(sel);
    setter((p) => !p);
  };`,
  `    clickEngine(sel);
    setter((p) => !p);
  }, [clickEngine]);`
).replace(
  `    showToast(tool === 'draw' ? tr.editor.toasts.drawing : tool === 'erase' ? tr.editor.toasts.erasing : tr.editor.toasts.selecting);
  };`,
  `    showToast(tool === 'draw' ? tr.editor.toasts.drawing : tool === 'erase' ? tr.editor.toasts.erasing : tr.editor.toasts.selecting);
  }, [clickEngine, showToast, tr]);`
).replace(
  `    }
    showToast(tr.editor.toasts.undo);
  };`,
  `    }
    showToast(tr.editor.toasts.undo);
  }, [bridge, clickEngine, showToast, tr]);`
).replace(
  `    }
    showToast(tr.editor.toasts.redo);
  };`,
  `    }
    showToast(tr.editor.toasts.redo);
  }, [bridge, clickEngine, showToast, tr]);`
);

fs.writeFileSync('app/ui/EditorUI.tsx', code);
