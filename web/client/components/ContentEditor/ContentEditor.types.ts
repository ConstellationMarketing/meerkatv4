/**
 * Type definitions for the Content Editor
 */

export interface FloatingToolbarState {
  visible: boolean;
  x: number;
  y: number;
}

export interface ContentEditorProps {
  /** Initial HTML content for the editor */
  initialContent?: string;

  /** Initial title for the article */
  initialTitle?: string;

  /** Initial description for the article */
  initialDescription?: string;

  /** Callback when content changes */
  onContentChange?: (content: string) => void;

  /** Callback when title changes */
  onTitleChange?: (title: string) => void;

  /** Callback when description changes */
  onDescriptionChange?: (description: string) => void;

  /** Custom handler for export */
  onExport?: (content: string, plainText: string) => void;

  /** Custom handler for import */
  onImport?: () => void;

  /** Title character limit */
  titleMaxLength?: number;

  /** Description character limit */
  descriptionMaxLength?: number;

  /** Whether to show metadata section by default */
  showMetadataByDefault?: boolean;

  /** Custom CSS class for the container */
  containerClassName?: string;

  /** Callback when schema button is clicked */
  onSchemaClick?: () => void;

  /** Callback when show navigation is clicked */
  onShowNavigation?: () => void;

  /** Whether navigation is hidden */
  isNavigationHidden?: boolean;

  /** Callback when save button is clicked */
  onSave?: () => void;

  /** Whether save button is disabled */
  isSaveDisabled?: boolean;

  /** Article keyword for copy formatting */
  articleKeyword?: string;

  /** Client name for copy formatting */
  clientName?: string;

  /** Callback when expand button is clicked */
  onExpand?: () => void;

  /** Whether the article is in expanded edit focus mode */
  isEditFocus?: boolean;

  /** Callback when public view button is clicked */
  onDevView?: () => void;

  /** Callback when client view button is clicked */
  onClientView?: () => void;

  /** Current view mode */
  currentView?: "seo" | "edit" | "public" | "client" | null;

  /** Callback when SEO view button is clicked */
  onSeoView?: () => void;

  /** Callback when resource page view button is clicked */
  onResourcePageView?: () => void;

  /** Callback when edit view button is clicked */
  onEditView?: () => void;

  /** Callback when public view button is clicked (alternative to onDevView) */
  onPublicView?: () => void;

  /** Callback when client view button is clicked (alternative to onClientView) */
  onClientViewClick?: () => void;
}

export interface EditorState {
  content: string;
  title: string;
  description: string;
  showMeta: boolean;
  showHeadingMenu: boolean;
  selectedHeading: string;
  floatingToolbar: FloatingToolbarState;
}
