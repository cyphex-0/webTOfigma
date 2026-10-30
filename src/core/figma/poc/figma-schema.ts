/**
 * Minimal Figma Kiwi Schema definition for direct clipboard encoding.
 * Matches Figma's internal binary wire protocol structure.
 */

export const FIGMA_KIWI_SCHEMA = `
package figma;

struct GUID {
  uint sessionID;
  uint localID;
}

struct Vector {
  float x;
  float y;
}

struct Color {
  float r;
  float g;
  float b;
  float a;
}

struct Matrix {
  float m00;
  float m01;
  float m02;
  float m10;
  float m11;
  float m12;
}

struct ParentIndex {
  GUID guid;
  int position;
}

enum NodeType {
  NONE = 0;
  DOCUMENT = 1;
  CANVAS = 2;
  GROUP = 3;
  FRAME = 4;
  BOOLEAN_OPERATION = 5;
  VECTOR = 6;
  STAR = 7;
  LINE = 8;
  ELLIPSE = 9;
  RECTANGLE = 10;
  REGULAR_POLYGON = 11;
  ROUNDED_RECTANGLE = 12;
  TEXT = 13;
  SECTION = 14;
}

enum PaintType {
  SOLID = 0;
  GRADIENT_LINEAR = 1;
  GRADIENT_RADIAL = 2;
  GRADIENT_ANGULAR = 3;
  GRADIENT_DIAMOND = 4;
  IMAGE = 5;
  EMOJI = 6;
}

struct Paint {
  PaintType type;
  Color color;
  float opacity;
  bool visible;
}

enum LayoutMode {
  NONE = 0;
  HORIZONTAL = 1;
  VERTICAL = 2;
}

message NodeChange {
  GUID guid = 1;
  NodeType type = 2;
  string name = 3;
  bool visible = 4;
  ParentIndex parentIndex = 5;
  Matrix transform = 6;
  Vector size = 7;
  Paint[] fillPaints = 8;
  Paint[] strokePaints = 9;
  float strokeWeight = 10;
  float cornerRadius = 11;
  Color backgroundColor = 12;
  string rawText = 13;
  float fontSize = 14;
  float fontWeight = 15;
  string fontFamily = 16;
  float letterSpacing = 17;
  float lineHeight = 18;
  int textAlignHorizontal = 19;
  int textAlignVertical = 20;
  int layoutMode = 21;
  int primaryAxisAlignItems = 22;
  int counterAxisAlignItems = 23;
  float itemSpacing = 24;
  float paddingTop = 25;
  float paddingRight = 26;
  float paddingBottom = 27;
  float paddingLeft = 28;
  bool clipsContent = 29;
  float opacity = 30;
}

message Message {
  NodeChange[] nodeChanges = 1;
  uint[] sessionIDs = 2;
}
`;
