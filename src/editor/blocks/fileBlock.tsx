import { fileBlockConfig, fileParse } from "@blocknote/core";
import { createReactBlockSpec } from "@blocknote/react";
import type { ReactCustomBlockRenderProps } from "@blocknote/react";
import { useCallback } from "react";
import { resolveFileDisplayUrl } from "../fileDisplayUrl";

function FileIcon(props: { block: { props: { caption?: string; url?: string } } }) {
  const { caption, url } = props.block.props;
  const iconUrl = caption || (url ? resolveFileDisplayUrl(url) : "");

  if (iconUrl) {
    return <img src={iconUrl} alt="" width={24} height={24} style={{ display: "block" }} />;
  }

  return (
    <svg width={24} height={24} viewBox="0 0 24 24" fill="currentColor">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM6 20V4h7v5h5v11H6z" />
    </svg>
  );
}

function FileBlockRender(
  props: ReactCustomBlockRenderProps<typeof fileBlockConfig, any, any>,
) {
  const addFileButtonMouseDownHandler = useCallback(
    (event: React.MouseEvent) => event.preventDefault(),
    [],
  );
  const addFileButtonClickHandler = useCallback(() => {
    props.editor.transact((tr: any) =>
      tr.setMeta(props.editor.filePanel!.plugins[0], {
        block: props.block,
      }),
    );
  }, [props.block, props.editor]);

  if (props.block.props.url === "") {
    return (
      <div
        className="bn-file-block-content-wrapper"
      >
        <div
          className="bn-add-file-button"
          onMouseDown={addFileButtonMouseDownHandler}
          onClick={addFileButtonClickHandler}
        >
          <div className="bn-add-file-button-icon">
            <FileIcon block={props.block} />
          </div>
          <div className="bn-add-file-button-text">Add file</div>
        </div>
      </div>
    );
  }

  return (
    <div className="bn-file-block-content-wrapper">
      <div
        className="bn-file-name-with-icon"
        contentEditable={false}
        draggable={false}
      >
        <div className="bn-file-icon">
          <FileIcon block={props.block} />
        </div>
        <p className="bn-file-name">
          {props.block.props.name || props.block.props.url}
        </p>
      </div>
    </div>
  );
}

export const fileBlock = createReactBlockSpec(fileBlockConfig, {
  render: FileBlockRender,
  parse: fileParse,
  toExternalHTML: (props) => {
    if (!props.block.props.url) {
      return <p>Add file</p>;
    }
    return (
      <a href={props.block.props.url}>
        {props.block.props.name || props.block.props.url}
      </a>
    );
  },
});
