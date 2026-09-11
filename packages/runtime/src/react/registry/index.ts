'use client';
import type { ComponentRegistry } from '../upstream.js';
import { Fallback } from './Fallback.js';
import * as actions from './actions.js';
import * as dataDisplay from './data-display.js';
import * as forms from './forms.js';
import * as layout from './layout.js';
import * as overlays from './overlay-surfaces.js';
// Spine renderers.
import * as layoutPrimitives from './layout-primitives.js';
import * as navigation from './navigation.js';
import * as formsExtended from './forms-extended.js';
import * as dataDisplayExtended from './data-display-extended.js';
import * as miscExtended from './misc-extended.js';
// Charts + AI-chat renderers.
import * as charts from './charts.js';
import * as chartsExtra from './charts-extra.js';
import * as aiChat from './ai-chat.js';
import * as aiFlow from './ai-flow.js';
import * as aiContent from './ai-content.js';
// Advanced inputs + DataTable renderers.
import * as inputsChoice from './inputs-choice.js';
import * as inputsNumeric from './inputs-numeric.js';
import * as inputsDate from './inputs-date.js';
import * as dataTable from './data-table.js';
import * as inputsOverlay from './inputs-overlay.js';
// Marketing + feedback + social/media renderers.
import * as marketingHero from './marketing-hero.js';
import * as marketingPage from './marketing-page.js';
import * as feedbackExtended from './feedback-extended.js';
import * as socialMedia from './social-media.js';
// Structure + board + filter + composer renderers.
import * as structureFlow from './structure-flow.js';
import * as layoutPane from './layout-pane.js';
import * as boardNav from './board-nav.js';
import * as filterCompose from './filter-compose.js';
// Long-tail renderers.
import * as chartsProportion from './charts-proportion.js';
import * as chartsRadial from './charts-radial.js';
import * as mediaExtended from './media-extended.js';
import * as inputsSpecialized from './inputs-specialized.js';
import * as utilOverlay from './util-overlay.js';
import * as dataLongtail from './data-longtail.js';
import * as timeClock from './time-clock.js';
import * as signaturePad from './signature-pad.js';
import * as scheduler from './scheduler.js';
import * as printLayout from './print-layout.js';
import * as blockDocumentEditor from './block-document-editor.js';
import * as notificationCenter from './notification-center.js';
import * as logConsole from './log-console.js';
import * as editableSpreadsheetGrid from './editable-spreadsheet-grid.js';
import * as permissionMatrix from './permission-matrix.js';
import * as programGuideGrid from './program-guide-grid.js';
import * as mediaScrubber from './media-scrubber.js';
import * as nodeGraph from './node-graph.js';
import * as tournamentBracket from './tournament-bracket.js';
import * as bodyMap from './body-map.js';
import * as mapView from './map-view.js';
import * as floorPlan from './floor-plan.js';
import * as mediaAnnotator from './media-annotator.js';
import * as mapEmbed from './map-embed.js';
import * as fileEmbed from './file-embed.js';
import * as icon from './icon.js';

// Any type without a registry entry renders via the inert `fallback={Fallback}`
// the renderer is given (see FraymeRenderer) — unmapped types never crash.

/** React implementations for the @frayme/catalog vocabulary. */
export const defaultRegistry: ComponentRegistry = {
  // layout
  Card: layout.Card,
  Stack: layout.Stack,
  Grid: layout.Grid,
  Separator: layout.Separator,
  Tabs: layout.Tabs,
  Accordion: layout.Accordion,
  Collapsible: layout.Collapsible,
  Carousel: layout.Carousel,
  // data display
  Table: dataDisplay.Table,
  Heading: dataDisplay.Heading,
  Text: dataDisplay.Text,
  Image: dataDisplay.Image,
  Avatar: dataDisplay.Avatar,
  Badge: dataDisplay.Badge,
  Alert: dataDisplay.Alert,
  Progress: dataDisplay.Progress,
  Skeleton: dataDisplay.Skeleton,
  Spinner: dataDisplay.Spinner,
  // overlays
  Dialog: overlays.Dialog,
  Drawer: overlays.Drawer,
  Tooltip: overlays.Tooltip,
  Popover: overlays.Popover,
  // forms
  Input: forms.Input,
  Textarea: forms.Textarea,
  Select: forms.Select,
  Checkbox: forms.Checkbox,
  Radio: forms.Radio,
  Switch: forms.Switch,
  Slider: forms.Slider,
  // actions
  Button: actions.Button,
  Link: actions.Link,
  DropdownMenu: actions.DropdownMenu,
  Toggle: actions.Toggle,
  ToggleGroup: actions.ToggleGroup,
  ButtonGroup: actions.ButtonGroup,
  Pagination: actions.Pagination,
  // layout primitives
  Box: layoutPrimitives.Box,
  Container: layoutPrimitives.Container,
  Section: layoutPrimitives.Section,
  // navigation
  Breadcrumb: navigation.Breadcrumb,
  Sidebar: navigation.Sidebar,
  SidebarItem: navigation.SidebarItem,
  Navbar: navigation.Navbar,
  // forms extended
  Form: formsExtended.Form,
  FormField: formsExtended.FormField,
  FieldError: formsExtended.FieldError,
  Label: formsExtended.Label,
  SearchInput: formsExtended.SearchInput,
  // data-display extended
  Tag: dataDisplayExtended.Tag,
  ListItem: dataDisplayExtended.ListItem,
  PageHeader: dataDisplayExtended.PageHeader,
  Stat: dataDisplayExtended.Stat,
  EmptyState: dataDisplayExtended.EmptyState,
  ErrorState: dataDisplayExtended.ErrorState,
  // misc extended
  IconButton: miscExtended.IconButton,
  Toast: miscExtended.Toast,
  CodeBlock: miscExtended.CodeBlock,
  // charts
  AreaChart: charts.AreaChart,
  BarChart: charts.BarChart,
  LineChart: charts.LineChart,
  DonutChart: charts.DonutChart,
  Sparkline: charts.Sparkline,
  // charts-extra
  BarList: chartsExtra.BarList,
  ProgressCircle: chartsExtra.ProgressCircle,
  StatGroup: chartsExtra.StatGroup,
  Heatmap: chartsExtra.Heatmap,
  Gantt: chartsExtra.Gantt,
  // ai-chat core
  Conversation: aiChat.Conversation,
  Message: aiChat.Message,
  MessageContent: aiChat.MessageContent,
  PromptInput: aiChat.PromptInput,
  // ai-chat flow
  Reasoning: aiFlow.Reasoning,
  ToolCall: aiFlow.ToolCall,
  Task: aiFlow.Task,
  Confirmation: aiFlow.Confirmation,
  Suggestion: aiFlow.Suggestion,
  TypingIndicator: aiFlow.TypingIndicator,
  // ai-content
  Sources: aiContent.Sources,
  InlineCitation: aiContent.InlineCitation,
  Artifact: aiContent.Artifact,
  WebPreview: aiContent.WebPreview,
  Shimmer: aiContent.Shimmer,
  DiffView: aiContent.DiffView,
  // advanced inputs — choice
  MultiSelect: inputsChoice.MultiSelect,
  Combobox: inputsChoice.Combobox,
  TagInput: inputsChoice.TagInput,
  SegmentedControl: inputsChoice.SegmentedControl,
  // advanced inputs — numeric
  NumberInput: inputsNumeric.NumberInput,
  RangeSlider: inputsNumeric.RangeSlider,
  Rating: inputsNumeric.Rating,
  OTPInput: inputsNumeric.OTPInput,
  // advanced inputs — date
  DatePicker: inputsDate.DatePicker,
  DateRangePicker: inputsDate.DateRangePicker,
  Calendar: inputsDate.Calendar,
  // data table
  DataTable: dataTable.DataTable,
  ColumnHeader: dataTable.ColumnHeader,
  // advanced inputs — overlay
  FileUpload: inputsOverlay.FileUpload,
  CommandPalette: inputsOverlay.CommandPalette,
  // marketing — hero
  Hero: marketingHero.Hero,
  CTA: marketingHero.CTA,
  FeatureGrid: marketingHero.FeatureGrid,
  FeatureCard: marketingHero.FeatureCard,
  LogoCloud: marketingHero.LogoCloud,
  // marketing — page
  Testimonial: marketingPage.Testimonial,
  FAQ: marketingPage.FAQ,
  Footer: marketingPage.Footer,
  PricingTable: marketingPage.PricingTable,
  PlanCard: marketingPage.PlanCard,
  // feedback — extended
  Banner: feedbackExtended.Banner,
  Callout: feedbackExtended.Callout,
  InlineMessage: feedbackExtended.InlineMessage,
  LoadingOverlay: feedbackExtended.LoadingOverlay,
  NotFound: feedbackExtended.NotFound,
  Result: feedbackExtended.Result,
  // social & media
  FeedItem: socialMedia.FeedItem,
  AvatarGroup: socialMedia.AvatarGroup,
  Gallery: socialMedia.Gallery,
  MediaGrid: socialMedia.MediaGrid,
  Lightbox: socialMedia.Lightbox,
  Comment: socialMedia.Comment,
  CommentThread: socialMedia.CommentThread,
  SocialBar: socialMedia.SocialBar,
  // structure — flow
  Timeline: structureFlow.Timeline,
  TimelineItem: structureFlow.TimelineItem,
  Stepper: structureFlow.Stepper,
  Tree: structureFlow.Tree,
  // structure — layout panes
  SplitPane: layoutPane.SplitPane,
  Resizable: layoutPane.Resizable,
  VirtualList: layoutPane.VirtualList,
  DescriptionList: layoutPane.DescriptionList,
  // board + nav
  KanbanBoard: boardNav.KanbanBoard,
  BoardColumn: boardNav.BoardColumn,
  KanbanCard: boardNav.KanbanCard,
  NavigationMenu: boardNav.NavigationMenu,
  // filter + composer
  FilterBar: filterCompose.FilterBar,
  FacetList: filterCompose.FacetList,
  FilterPanel: filterCompose.FilterPanel,
  RichComposer: filterCompose.RichComposer,
  // charts — proportion
  PieChart: chartsProportion.PieChart,
  FunnelChart: chartsProportion.FunnelChart,
  ScatterChart: chartsProportion.ScatterChart,
  RadarChart: chartsProportion.RadarChart,
  Sankey: chartsProportion.Sankey,
  // charts — radial
  Gauge: chartsRadial.Gauge,
  RadialBar: chartsRadial.RadialBar,
  Tracker: chartsRadial.Tracker,
  Candlestick: chartsRadial.Candlestick,
  Treemap: chartsRadial.Treemap,
  // media — extended
  VideoPlayer: mediaExtended.VideoPlayer,
  AudioPlayer: mediaExtended.AudioPlayer,
  Marquee: mediaExtended.Marquee,
  Figure: mediaExtended.Figure,
  Thumbnail: mediaExtended.Thumbnail,
  YouTube: mediaExtended.YouTube,
  // inputs — specialized
  ColorPicker: inputsSpecialized.ColorPicker,
  TimePicker: inputsSpecialized.TimePicker,
  QuantityStepper: inputsSpecialized.QuantityStepper,
  PhoneInput: inputsSpecialized.PhoneInput,
  CopyButton: inputsSpecialized.CopyButton,
  // util + overlay
  Toggletip: utilOverlay.Toggletip,
  Backdrop: utilOverlay.Backdrop,
  HoverCard: utilOverlay.HoverCard,
  Kbd: utilOverlay.Kbd,
  Highlight: utilOverlay.Highlight,
  // data — long-tail
  JsonView: dataLongtail.JsonView,
  Menubar: dataLongtail.Menubar,
  Fab: dataLongtail.Fab,
  RelativeTime: dataLongtail.RelativeTime,

  // time-clock — the duration-clock family
  Timer: timeClock.Timer,
  Stopwatch: timeClock.Stopwatch,

  // signature — pointer-drawn capture (CanvasSurface engine)
  SignaturePad: signaturePad.SignaturePad,

  // scheduler — day/week time-grid (TimeAxisGrid engine)
  Scheduler: scheduler.Scheduler,

  // doc-output
  PrintLayout: printLayout.PrintLayout,
  BlockDocumentEditor: blockDocumentEditor.BlockDocumentEditor,

  // live-snapshot
  NotificationCenter: notificationCenter.NotificationCenter,
  LogConsole: logConsole.LogConsole,

  // editable-grid
  EditableSpreadsheetGrid: editableSpreadsheetGrid.EditableSpreadsheetGrid,
  PermissionMatrix: permissionMatrix.PermissionMatrix,

  // time-geometry
  ProgramGuideGrid: programGuideGrid.ProgramGuideGrid,
  MediaScrubber: mediaScrubber.MediaScrubber,

  // diagram-svg
  NodeGraph: nodeGraph.NodeGraph,
  TournamentBracket: tournamentBracket.TournamentBracket,
  BodyMap: bodyMap.BodyMap,

  // geo
  MapView: mapView.MapView,
  FileEmbed: fileEmbed.FileEmbed,

  // pointer-canvas
  FloorPlan: floorPlan.FloorPlan,
  MediaAnnotator: mediaAnnotator.MediaAnnotator,

  // geo
  MapEmbed: mapEmbed.MapEmbed,

  // primitive — standalone glyph
  Icon: icon.Icon,
};

/** Merge per-app component overrides over the default registry. */
export function createRegistry(overrides?: ComponentRegistry): ComponentRegistry {
  return overrides ? { ...defaultRegistry, ...overrides } : defaultRegistry;
}

export { Fallback };
