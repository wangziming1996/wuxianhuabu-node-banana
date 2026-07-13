import { ImageNode } from './ImageNode'
import { TextNode } from './TextNode'
import { CharacterNode } from './CharacterNode'
import { AudioNode } from './AudioNode'
import { CustomNode } from './CustomNode'

export const NODE_TYPES = {
  image: ImageNode,
  text: TextNode,
  character: CharacterNode,
  audio: AudioNode,
  custom: CustomNode,
}
