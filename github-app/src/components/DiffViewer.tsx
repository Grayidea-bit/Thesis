import React from 'react';
import ReactDiffViewer from 'react-diff-viewer-continued';

interface DiffViewerProps {
  oldCode: string;
  newCode: string;
  oldFileName?: string;
  newFileName?: string;
}

const DiffViewer: React.FC<DiffViewerProps> = ({
  oldCode,
  newCode,
  oldFileName = 'Old Version',
  newFileName = 'New Version'
}) => {
  const darkTheme = {
    variables: { 
      dark: {
        diffViewerBackground: '#2d323e',
        diffViewerColor: '#FFF',
        addedBackground: '#044B53',
        addedColor: 'white',
        removedBackground: '#632F34',
        removedColor: 'white',
        wordAddedBackground: '#055d67',
        wordRemovedBackground: '#7d383f',
        addedGutterBackground: '#034148',
        removedGutterBackground: '#632b30',
        gutterBackground: '#2d323e',
        gutterBackgroundDark: '#262933',
        highlightBackground: '#2a3967',
        highlightGutterBackground: '#2d4077',
      }
    },
    diffView: {
      content: {
        fontFamily: 'SFMono-Regular,Consolas,Liberation Mono,Menlo,monospace',
      },
    },
  };

  return (
    <div className="diff-viewer-container">
      <ReactDiffViewer
        oldValue={oldCode}
        newValue={newCode}
        splitView={true}
        useDarkTheme={true}
        leftTitle={oldFileName}
        rightTitle={newFileName}
        styles={darkTheme}
        extraLinesSurroundingDiff={3}
      />
    </div>
  );
};

export default DiffViewer;
