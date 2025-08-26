"use client";

import {
	Blend,
	Crop,
	Funnel,
	ImageUpscale,
	RotateCwSquare,
	SlidersHorizontal,
	Sparkles,
} from "lucide-react";

import { Button, type ButtonProps } from "@/ui/button";
import { cn } from "@/lib/utils";
import type { TOOL_VALUES } from "@/lib/tools";
import type { EditorLayer } from "@/lib/editor/state";
import {
	SIDEBAR_TOOLS,
	type ImageEditorToolsActions,
} from "@/lib/state.image-editor";

export interface ImageEditorSidebarProps
	extends Omit<React.ComponentProps<"ul">, "onChange"> {
	progress?: number;
	selectedLayer: EditorLayer;
	selectedSidebar: keyof typeof SIDEBAR_TOOLS;
	dispatch: React.Dispatch<ImageEditorToolsActions>;
	onChange: (selected: keyof typeof SIDEBAR_TOOLS) => void;
	onSelectedToolChange: (tool: keyof typeof TOOL_VALUES) => void;
}
export function ImageEditorSidebar({
	className,
	onChange,
	onSelectedToolChange,
	dispatch,
	progress,
	selectedLayer,
	selectedSidebar,
	...props
}: ImageEditorSidebarProps) {
	const isDocumentLayer = selectedLayer?.id === "document";

	return (
		<ul className={cn("flex flex-col gap-2 p-2", className)} {...props}>
			<li>
				<SidebarButton
					title={
						isDocumentLayer ? "Rotate Document (All Layers)" : "Rotate Layer"
					}
					footerType="rotate"
					disabled={progress || isDocumentLayer}
					selectedSidebar={selectedSidebar}
					onChange={onChange}
					onSelectedToolChange={onSelectedToolChange}
				>
					<RotateCwSquare />
					{isDocumentLayer ? "Document Rotate" : "Rotate"}
				</SidebarButton>
			</li>

			<li>
				<SidebarButton
					title="Resize"
					footerType="resize"
					disabled={progress || isDocumentLayer}
					selectedSidebar={selectedSidebar}
					onChange={onChange}
					onSelectedToolChange={onSelectedToolChange}
				>
					<ImageUpscale />
					Resize
				</SidebarButton>
			</li>

			<li>
				<SidebarButton
					title="Scale"
					footerType="scale"
					disabled={progress || isDocumentLayer}
					selectedSidebar={selectedSidebar}
					onChange={onChange}
					onSelectedToolChange={onSelectedToolChange}
				>
					<ImageUpscale />
					Scale
				</SidebarButton>
			</li>

			<li>
				<SidebarButton
					title="Upscale"
					footerType="upscale"
					disabled={progress || isDocumentLayer}
					selectedSidebar={selectedSidebar}
					onChange={onChange}
					onSelectedToolChange={onSelectedToolChange}
				>
					<ImageUpscale />
					Upscale
				</SidebarButton>
			</li>

			<li>
				<SidebarButton
					title="Crop"
					footerType="crop"
					disabled={progress || isDocumentLayer}
					selectedSidebar={selectedSidebar}
					onChange={onChange}
					onSelectedToolChange={onSelectedToolChange}
				>
					<Crop />
					Crop
				</SidebarButton>
			</li>

			<li>
				<SidebarButton
					title="Filters"
					footerType="effects"
					disabled={progress || isDocumentLayer}
					selectedSidebar={selectedSidebar}
					onChange={onChange}
					onSelectedToolChange={onSelectedToolChange}
				>
					<SlidersHorizontal />
					Filters
				</SidebarButton>
			</li>
			<li>
				<SidebarButton
					title="Presets"
					footerType="presets"
					disabled={progress || isDocumentLayer}
					selectedSidebar={selectedSidebar}
					onChange={onChange}
					onSelectedToolChange={onSelectedToolChange}
				>
					<Sparkles />
					Presets
				</SidebarButton>
			</li>
		</ul>
	);
}

interface SidebarButtonProps extends Omit<ButtonProps, "selected"> {
	footerType: keyof typeof SIDEBAR_TOOLS;
	selectedSidebar: keyof typeof SIDEBAR_TOOLS;
	onChange: (selected: keyof typeof SIDEBAR_TOOLS) => void;
	onSelectedToolChange: (tool: keyof typeof TOOL_VALUES) => void;
}

function SidebarButton({
	footerType,
	selectedSidebar,
	onChange,
	onSelectedToolChange,
	disabled,
	children,
	title,
}: SidebarButtonProps) {
	return (
		<Button
			title={title}
			variant="ghost"
			className={cn("flex flex-col rounded-md text-xs size-12", {
				"bg-accent text-accent-foreground": selectedSidebar === footerType,
			})}
			onClick={() => {
				onChange(footerType);
				if (!SIDEBAR_TOOLS.rotate.includes(selectedSidebar)) {
					onSelectedToolChange(footerType as keyof typeof TOOL_VALUES);
				}
			}}
			disabled={disabled}
		>
			{children}
		</Button>
	);
}
