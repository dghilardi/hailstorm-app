import { editor } from "monaco-editor";

const gruvbox_light: editor.IStandaloneThemeData = {
    "base": "vs-dark",
    "inherit": true,
    "rules": [
      {
        "background": "#282828",
        "token": ""
      },
      {
        "foreground": "#A89984",
        "fontStyle": "italic",
        "token": "comment.line.json"
      },
      {
        "foreground": "#A89984",
        "fontStyle": "italic",
        "token": "comment.block.json"
      },
      {
        "foreground": "#B16286",
        "token": "number.json"
      },
      {
        "foreground": "#B16286",
        "token": "keyword.json"
      },
      {
        "foreground": "#EBDBB2",
        "token": "string.key.json"
      },
      {
        "foreground": "#689D6A",
        "token": "string.value.json"
      },
      {
        "foreground": "#D79921",
        "token": "delimiter.bracket.json"
      },
      {
        "foreground": "#D79921",
        "token": "delimiter.array.json"
      },
      {
        "foreground": "#EBDBB2",
        "token": "delimiter.colon.json"
      },
      {
        "foreground": "#EBDBB2",
        "token": "delimiter.comma.json"
      }
    ],
    "colors": {
      "editorBracketMatch.background":"#3C3836",
      "editorBracketMatch.border": "#3C3836",
      "editorLineNumber.foreground": "#3C3836",
      "editor.background": "#282828",
      "editor.foreground": "#EBDBB2",
      "editor.selectionBackground": "#3C3836",
      "editor.lineHighlightBackground": "#3C3836",
      "editorCursor.foreground": "#EBDBB2",
      "editorIndentGuide.background": "#3C3836",
      "editorIndentGuide.activeBackground": "#D79921",
      "editorWhitespace.foreground": "#282828"
    }
  };

  export default gruvbox_light;