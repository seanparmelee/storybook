import React, { createContext, useContext, useState, useRef, useEffect } from 'react';

import { PreviewWeb } from '@storybook/preview-web';
import { Path, ModuleExports, StoryIndex } from '@storybook/store';
import { toId, AnyFramework, ComponentTitle, StoryId } from '@storybook/csf';

// @ts-ignore
import * as reactAnnotations from '@storybook/react/dist/esm/client/preview/config';

type StoryExport = any;
type MetaExport = any;
type ExportName = string;

const projectAnnotations = {
  ...reactAnnotations,
};

const DocsContext = createContext<{
  setMeta: (meta: MetaExport) => void;
  addStory: (story: StoryExport, storyMeta?: MetaExport) => void;
  renderStory: (story: StoryExport, element: HTMLElement) => void;
}>({
  setMeta: () => {},
  addStory: () => {},
  renderStory: () => {},
});

export const DocsProvider: React.FC = ({ children }) => {
  let pageMeta: MetaExport;
  const setMeta = (m: MetaExport) => {
    pageMeta = m;
  };

  let nextImportPath = 0;
  const importPaths = new Map<MetaExport, Path>();
  const getImportPath = (meta: MetaExport) => {
    if (!importPaths.has(meta)) {
      importPaths.set(meta, `importPath-${nextImportPath}`);
      nextImportPath += 1;
    }
    return importPaths.get(meta) as Path;
  };

  let nextTitle = 0;
  const titles = new Map<MetaExport, ComponentTitle>();
  const getTitle = (meta: MetaExport) => {
    if (!titles.has(meta)) {
      titles.set(meta, `title-${nextTitle}`);
      nextTitle += 1;
    }
    return titles.get(meta);
  };

  let nextExportName = 0;
  const exportNames = new Map<StoryExport, ExportName>();
  const getExportName = (story: StoryExport) => {
    if (!exportNames.has(story)) {
      exportNames.set(story, `export-${nextExportName}`);
      nextExportName += 1;
    }
    return exportNames.get(story) as ExportName;
  };

  const storyIds = new Map<StoryExport, StoryId>();

  const storyIndex: StoryIndex = { v: 3, stories: {} };
  const knownCsfFiles: Record<Path, ModuleExports> = {};

  const addStory = (storyExport: StoryExport, storyMeta?: MetaExport) => {
    const meta = storyMeta || pageMeta;
    const importPath: Path = getImportPath(meta);
    const title: ComponentTitle = meta.title || getTitle(meta);

    const exportName = getExportName(storyExport);
    const storyId = toId(title, exportName);
    storyIds.set(storyExport, storyId);

    if (!knownCsfFiles[importPath]) {
      knownCsfFiles[importPath] = {
        default: meta,
      };
    }
    knownCsfFiles[importPath][exportName] = storyExport;

    storyIndex.stories[storyId] = {
      id: storyId,
      importPath,
      title,
      name: 'Name',
    };
  };

  let previewPromise: Promise<PreviewWeb<AnyFramework>>;
  const getPreview = () => {
    if (!previewPromise) {
      previewPromise = (async () => {
        const preview = new PreviewWeb();
        await preview.initialize({
          getStoryIndex: () => storyIndex,
          importFn: (importPath) => {
            console.log(knownCsfFiles, importPath);
            return Promise.resolve(knownCsfFiles[importPath]);
          },
          getProjectAnnotations: () => projectAnnotations,
        });

        return preview;
      })();
    }

    return previewPromise;
  };

  const renderStory = async (storyExport: any, element: HTMLElement) => {
    const preview = await getPreview();

    const storyId = storyIds.get(storyExport);
    if (!storyId) throw new Error(`Didn't find story id '${storyId}'`);
    const story = await preview.storyStore.loadStory({ storyId });

    console.log({ story });

    preview.renderStoryToElement(story, element);
  };

  return (
    <DocsContext.Provider value={{ setMeta, addStory, renderStory }}>
      {children}
    </DocsContext.Provider>
  );
};

export function Meta({ of }: { of: any }) {
  const { setMeta } = useContext(DocsContext);
  setMeta(of);
  return null;
}

export function Story({ of, meta }: { of: any; meta?: any }) {
  const { addStory, renderStory } = useContext(DocsContext);

  addStory(of, meta);

  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) renderStory(of, ref.current);
  });

  return <div ref={ref} />;
}
