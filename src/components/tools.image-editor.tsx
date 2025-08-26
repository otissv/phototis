"use client";

import * as React from "react";
import type { SIDEBAR_TOOLS } from "@/lib/state.image-editor";

import { ImageEditorButton } from "./button.image-editor";
import {
	ChevronDown,
	CircleDot,
	Download,
	FlipHorizontal2,
	FlipVertical2,
	History,
	ImageIcon,
	MoveHorizontal,
	Redo,
	RotateCwSquare,
	Square,
	Undo,
} from "lucide-react";

import type {
	ImageEditorHeaderProps,
	ImageEditorFooterProps,
} from "@/components/tools/utils.tools";
import { RotationControls } from "@/components/tools/rotation.tools";
import { ScaleButton, ScaleControls } from "@/components/tools/scale.tools";
import { ResizeButton, ResizeControls } from "@/components/tools/resize.tools";
import {
	UpscaleButton,
	UpscaleControls,
} from "@/components/tools/upscale.tools";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/ui/dropdown-menu";
import { useWebGLDownload } from "@/components/useWebGLDownload";
import { useEditorContext } from "@/lib/editor/context";
import { Button } from "@/ui/button";
import { QualityOptions } from "./quaity-options.image-editor";
import {
	SharpenButton,
	SharpenControls,
} from "@/components/tools/sharpen.tools";

import { NoiseButton, NoiseControls } from "@/components/tools/noise.tools";
import { CropButton, CropControls } from "@/components/tools/crop.tools";
import type {
	ToolValueCropType,
	ToolValueDimensionType,
	ToolValueNumberType,
} from "@/lib/tools";
import { cn } from "@/lib/utils";

export function ImageEditorFooter({
	selectedSidebar,
	...props
}: ImageEditorFooterProps & {
	selectedSidebar: keyof typeof SIDEBAR_TOOLS;
}) {
	switch (selectedSidebar) {
		case "effects":
			return <EffectsFooter {...props} />;
		case "rotate":
			return <RotateFooter {...props} />;
		case "resize":
			return <ResizeFooter {...props} />;
		case "scale":
			return <ScaleFooter {...props} />;
		case "upscale":
			return <UpscaleFooter {...props} />;
		case "crop":
			return <CropFooter {...props} />;

		default:
			return null;
	}
}

/**
 * Effects
 */
export function EffectsFooter({
	selectedTool,
	value,
	onSelectedToolChange,
	dispatch,
	toolsValues,
	progress,
	onChange: _onChange,
	onProgress: _onProgress,
	canvasRef,
	drawFnRef,
	selectedLayer,
	...props
}: ImageEditorFooterProps) {
	const { history } = useEditorContext();
	const handleOnChange = React.useCallback(
		(value: number) => {
			switch (selectedTool) {
				case "sharpen":
					history.begin("Sharpen");
					dispatch({ type: "sharpen", payload: value });
					history.end(true);
					return;
				case "blur":
					history.begin("Blur");
					dispatch({ type: "blur", payload: value });
					history.end(true);
					return;
				case "blurType":
					history.begin("Blur Type");
					dispatch({ type: "blurType", payload: value });
					history.end(true);
					return;
				case "blurDirection":
					history.begin("Blur Direction");
					dispatch({ type: "blurDirection", payload: value });
					history.end(true);
					return;
				case "blurCenter":
					history.begin("Blur Center");
					dispatch({ type: "blurCenter", payload: value });
					history.end(true);
					return;
				case "noise":
					history.begin("Noise");
					dispatch({ type: "noise", payload: value });
					history.end(true);
					return;
				case "grain":
					history.begin("Grain");
					dispatch({ type: "grain", payload: value });
					history.end(true);
					return;
				case "sepia":
					history.begin("Sepia");
					dispatch({ type: "sepia", payload: value });
					history.end(true);
					return;
				default:
					return () => {};
			}
		},
		[history, selectedTool, dispatch],
	);

	const Control = React.useMemo(() => {
		const controlProps = {
			value,
			progress,
			selectedTool,
			toolsValues,
			dispatch,
			canvasRef,
			drawFnRef,
			selectedLayer,
			onChange: handleOnChange,
		};
		switch (selectedTool) {
			case "noise":
				return <NoiseControls {...controlProps} />;
			case "sharpen":
				return <SharpenControls {...controlProps} />;
		}
	}, [
		selectedTool,
		value,
		progress,
		handleOnChange,
		selectedLayer,
		toolsValues,
		dispatch,
		canvasRef,
		drawFnRef,
	]);

	const renderBlurControls = () => {
		if (selectedTool === "blur") {
			return (
				<div className="flex flex-col gap-4 mt-4">
					<div className="flex gap-2 justify-center">
						<ImageEditorButton
							variant="ghost"
							onClick={() => dispatch({ type: "blurType", payload: 0 })}
							isActive={toolsValues?.blurType === 0}
							disabled={progress}
						>
							<ImageIcon size={16} className="mr-1" />
							Gaussian
						</ImageEditorButton>
						<ImageEditorButton
							variant="ghost"
							onClick={() => dispatch({ type: "blurType", payload: 1 })}
							isActive={toolsValues?.blurType === 1}
							disabled={progress}
						>
							<Square size={16} className="mr-1" />
							Box
						</ImageEditorButton>
						<ImageEditorButton
							variant="ghost"
							onClick={() => dispatch({ type: "blurType", payload: 2 })}
							isActive={toolsValues?.blurType === 2}
							disabled={progress}
						>
							<MoveHorizontal size={16} className="mr-1" />
							Motion
						</ImageEditorButton>
						<ImageEditorButton
							variant="ghost"
							onClick={() => dispatch({ type: "blurType", payload: 3 })}
							isActive={toolsValues?.blurType === 3}
							disabled={progress}
						>
							<CircleDot size={16} className="mr-1" />
							Radial
						</ImageEditorButton>
					</div>

					{toolsValues?.blurType === 2 && (
						<div className="flex flex-col gap-2">
							<span className="text-sm text-muted-foreground">Direction</span>
						</div>
					)}

					{toolsValues?.blurType === 3 && (
						<div className="flex flex-col gap-2">
							<span className="text-sm text-muted-foreground">Center</span>
						</div>
					)}
				</div>
			);
		}
		return null;
	};

	return (
		<div {...props}>
			<div className="flex justify-center overflow-x-auto ">
				<div className="max-w-lg w-full flex flex-col items-center justify-center">
					{Control}
				</div>
			</div>
			<ul className="flex gap-6 w-full max-w-lg overflow-x-auto py-2">
				<li>
					<ImageEditorButton
						isActive={selectedTool === "blur"}
						variant="ghost"
						onClick={() => onSelectedToolChange("blur")}
					>
						Blur
					</ImageEditorButton>
				</li>
				<li>
					<SharpenButton
						onSelectedToolChange={onSelectedToolChange}
						selectedTool={selectedTool}
						progress={progress}
					/>
				</li>

				<li>
					<NoiseButton
						onSelectedToolChange={onSelectedToolChange}
						selectedTool={selectedTool}
						progress={progress}
					/>
				</li>
			</ul>
			{renderBlurControls()}
		</div>
	);
}

/**
 * Rotate
 */
export function RotateFooter({
	progress,
	selectedTool,
	toolsValues,
	value,
	dispatch,
	onSelectedToolChange,
	canvasRef,
	drawFnRef,
	selectedLayer,
	...props
}: Omit<ImageEditorFooterProps, "onChange" | "onProgress">) {
	const { rotateDocument } = useEditorContext();
	const isDocumentLayer = selectedLayer?.id === "document";

	const safeRotate =
		typeof (toolsValues as any)?.rotate === "number"
			? (toolsValues as any).rotate
			: 0;
	const safeFlipH = Boolean((toolsValues as any)?.flipHorizontal);
	const safeFlipV = Boolean((toolsValues as any)?.flipVertical);

	const handleRotateLeft = () => {
		if (isDocumentLayer) {
			// Document rotation - rotate all layers
			console.log("Rotating document left by 90°");
			rotateDocument(-90);
		} else {
			// Individual layer rotation
			const currentRotation = safeRotate;
			// Invert rotation direction if image is flipped horizontally
			const rotationDirection = safeFlipH ? -90 : 90;
			const newRotation = (currentRotation + rotationDirection + 360) % 360;
			dispatch({ type: "rotate", payload: newRotation });
		}
	};

	const handleRotateRight = () => {
		if (isDocumentLayer) {
			// Document rotation - rotate all layers
			console.log("Rotating document right by 90°");
			rotateDocument(90);
		} else {
			// Individual layer rotation
			const currentRotation = safeRotate;
			// Invert rotation direction if image is flipped horizontally
			const rotationDirection = safeFlipH ? 90 : -90;
			const newRotation = (currentRotation + rotationDirection + 360) % 360;
			dispatch({ type: "rotate", payload: newRotation });
		}
	};

	const handleFlipHorizontal = () => {
		if (isDocumentLayer) {
			// Document flip - apply to all layers
			// For now, we'll just flip the selected layer, but this could be enhanced
			// to flip all layers as a document operation
			dispatch([
				{
					type: "flipHorizontal",
					payload: safeFlipH ? 0 : 1,
				},
			]);
		} else {
			// Individual layer flip
			dispatch([
				{
					type: "flipHorizontal",
					payload: safeFlipH ? 0 : 1,
				},
			]);
		}
	};

	const handleFlipVertical = () => {
		if (isDocumentLayer) {
			// Document flip - apply to all layers
			// For now, we'll just flip the selected layer, but this could be enhanced
			// to flip all layers as a document operation
			dispatch({
				type: "flipVertical",
				payload: safeFlipV ? 0 : 1,
			});
		} else {
			// Individual layer flip
			dispatch({
				type: "flipVertical",
				payload: safeFlipV ? 0 : 1,
			});
		}
	};

	const handleOnChange = React.useCallback(
		(value: number) => {
			if (isDocumentLayer) {
				// Document rotation - rotate all layers by the difference
				const currentRotation = safeRotate;
				const rotationDiff = value - currentRotation;
				rotateDocument(rotationDiff);
			} else {
				// Individual layer rotation
				dispatch({ type: selectedTool as any, payload: value } as any);
			}
		},
		[dispatch, selectedTool, isDocumentLayer, safeRotate, rotateDocument],
	);

	let operator = "";

	if (selectedTool === "rotate") {
		operator = "°";
	} else if (selectedTool === "scale") {
		operator = "%";
	}

	const Control = React.useMemo(() => {
		const controlProps = {
			value: safeRotate, // Use the safe rotation value
			progress,
			selectedTool,
			toolsValues,
			dispatch,
			canvasRef,
			drawFnRef,
			selectedLayer,
			onChange: handleOnChange,
		};
		switch (selectedTool) {
			case "rotate":
				return <RotationControls operator="°" {...controlProps} />;
		}
	}, [
		selectedTool,
		safeRotate, // Use safeRotate instead of value
		progress,
		handleOnChange,
		selectedLayer,
		toolsValues,
		dispatch,
		canvasRef,
		drawFnRef,
	]);

	return (
		<div {...props}>
			<div className="flex justify-center">
				<div className="max-w-lg w-full flex flex-col items-center justify-center">
					{Control}
				</div>
			</div>
			<ul className="flex gap-2 w-full justify-center">
				<li className="flex items-center gap-1">
					<ImageEditorButton
						title="Rotate image 90°"
						variant="ghost"
						onClick={handleRotateLeft}
						disabled={progress}
					>
						<RotateCwSquare size={16} className="mr-1" />
						Rotate 90°
					</ImageEditorButton>
				</li>
				<li className="flex items-center gap-1">
					<ImageEditorButton
						title="Flip image horizontally"
						variant="ghost"
						onClick={handleFlipHorizontal}
						disabled={progress}
					>
						<FlipHorizontal2 size={16} className="mr-1" />
						Flip Horizontal
					</ImageEditorButton>
				</li>
				<li className="flex items-center gap-1">
					<ImageEditorButton
						title="Flip image vertically"
						variant="ghost"
						onClick={handleFlipVertical}
						disabled={progress}
					>
						<FlipVertical2 size={16} className="mr-1" />
						Flip Vertical
					</ImageEditorButton>
				</li>
			</ul>
		</div>
	);
}

/**
 * Transform
 */

export function TransformHeader({
	selectedTool,
	toolsValues,
	onSelectedToolChange,
	dispatch,
	progress,
	onProgress,
	canvasRef,
	drawFnRef,
	...props
}: ImageEditorHeaderProps) {
	const [isOptionsOpen, setIsOptionsOpen] = React.useState(false);
	const [jpegQuality, setJpegQuality] = React.useState(80);
	const [webpQuality, setWebpQuality] = React.useState(80);

	const downloadImage = useWebGLDownload(canvasRef, drawFnRef);

	const handleOnDownload = React.useCallback(
		(mimeType: string, quality?: number) => () => {
			downloadImage(mimeType, quality ? quality / 100 : undefined);
		},
		[downloadImage],
	);

	const { history } = useEditorContext();
	const handleOnUndo = React.useCallback(() => {
		history.undo();
	}, [history]);

	const handleOnRedo = React.useCallback(() => {
		history.redo();
	}, [history]);

	return (
		<ul className="flex gap-1 justify-center" {...props}>
			<li>
				<ImageEditorButton
					title="Reset"
					variant="ghost"
					onClick={() => {
						dispatch({ type: "reset" });
					}}
					disabled={progress}
				>
					<History size={16} />
					Reset
				</ImageEditorButton>
			</li>

			<li className="flex items-center gap-1">
				<div className="w-[1px] h-6 bg-muted" />

				<ImageEditorButton
					title="Undo last action"
					variant="ghost"
					onClick={handleOnUndo}
					disabled={progress}
				>
					<Undo size={16} className="mr-1" />
					Undo
				</ImageEditorButton>
			</li>
			<li className="flex items-center gap-1">
				<ImageEditorButton
					title="Redo last action"
					variant="ghost"
					onClick={handleOnRedo}
					disabled={progress}
				>
					<Redo size={16} className="mr-1" />
					Redo
				</ImageEditorButton>
			</li>

			<li className="flex items-center gap-1">
				<div className="w-[1px] h-6 bg-muted" />

				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button
							title="Download image"
							variant="ghost"
							className="rounded-sm gap-2 text-xs"
						>
							<Download size={16} />
							Download <ChevronDown size={16} />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent>
						<QualityOptions
							description="Configure your download quality. These settings will affect the final file size and image quality of your download."
							title="JPEG Download Options"
							isOpen={isOptionsOpen}
							setIsOpen={setIsOptionsOpen}
							quality={jpegQuality}
							setQuality={setJpegQuality}
							onClick={handleOnDownload("image/jpeg", jpegQuality)}
						>
							JPEG
						</QualityOptions>
						<QualityOptions
							description="Configure your download quality. These settings will affect the final file size and image quality of your download."
							title="WebP Download Options"
							isOpen={isOptionsOpen}
							setIsOpen={setIsOptionsOpen}
							quality={webpQuality}
							setQuality={setWebpQuality}
							onClick={handleOnDownload("image/webp", webpQuality)}
						>
							WebP
						</QualityOptions>
						<DropdownMenuItem
							title="Download as PNG"
							onClick={handleOnDownload("image/png")}
						>
							Png
						</DropdownMenuItem>

						<DropdownMenuItem
							title="Download as GIF"
							onClick={handleOnDownload("image/gif")}
						>
							GIF
						</DropdownMenuItem>
						<DropdownMenuItem
							title="Download as AVIF"
							onClick={handleOnDownload("image/avif")}
						>
							AVIF
						</DropdownMenuItem>
						<DropdownMenuItem
							title="Download as ICO"
							onClick={handleOnDownload("image/ico")}
						>
							ICO
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</li>
		</ul>
	);
}

export function ScaleFooter({
	progress,
	selectedTool,
	toolsValues,
	value,
	dispatch,
	onSelectedToolChange,
	canvasRef,
	drawFnRef,
	selectedLayer,
	onProgress,
	className,
	...props
}: Omit<ImageEditorFooterProps, "onChange">) {
	const handleOnChange = React.useCallback(
		(value: number) => {
			dispatch({ type: selectedTool as any, payload: value } as any);
		},
		[dispatch, selectedTool],
	);

	const controlProps = {
		progress,
		selectedTool,
		toolsValues,
		dispatch,
		canvasRef,
		drawFnRef,
		selectedLayer,
		onProgress,
		onChange: handleOnChange,
	};

	return (
		<div className={cn("flex justify-center", className)} {...props}>
			<ScaleControls
				operator="%"
				isDecimal={true}
				value={value as ToolValueNumberType["defaultValue"]}
				{...controlProps}
			/>
		</div>
	);
}

export function ResizeFooter({
	progress,
	selectedTool,
	toolsValues,
	value,
	dispatch,
	onSelectedToolChange,
	canvasRef,
	drawFnRef,
	selectedLayer,
	onProgress,
	className,
	...props
}: Omit<ImageEditorFooterProps, "onChange">) {
	const handleOnChange = React.useCallback(
		(value: number) => {
			dispatch({ type: selectedTool as any, payload: value } as any);
		},
		[dispatch, selectedTool],
	);

	const controlProps = {
		progress,
		selectedTool,
		toolsValues,
		dispatch,
		canvasRef,
		drawFnRef,
		selectedLayer,
		onProgress,
		onChange: handleOnChange,
	};

	return (
		<div className={cn("flex justify-center", className)} {...props}>
			<ResizeControls
				value={value as ToolValueDimensionType["defaultValue"]}
				{...controlProps}
			/>
		</div>
	);
}

export function UpscaleFooter({
	progress,
	selectedTool,
	toolsValues,
	value,
	dispatch,
	onSelectedToolChange,
	canvasRef,
	drawFnRef,
	selectedLayer,
	onProgress,
	className,
	...props
}: Omit<ImageEditorFooterProps, "onChange">) {
	const handleOnChange = React.useCallback(
		(value: number) => {
			dispatch({ type: selectedTool as any, payload: value } as any);
		},
		[dispatch, selectedTool],
	);

	const controlProps = {
		progress,
		selectedTool,
		toolsValues,
		dispatch,
		canvasRef,
		drawFnRef,
		selectedLayer,
		onProgress,
		onChange: handleOnChange,
	};
	return (
		<div className={cn("flex justify-center", className)} {...props}>
			<UpscaleControls {...controlProps} value={value as number} />
		</div>
	);
}

export function CropFooter({
	progress,
	selectedTool,
	toolsValues,
	value,
	dispatch,
	onSelectedToolChange,
	canvasRef,
	drawFnRef,
	selectedLayer,
	onProgress,
	className,
	...props
}: Omit<ImageEditorFooterProps, "onChange">) {
	const handleOnChange = React.useCallback(
		(value: number) => {
			dispatch({ type: selectedTool as any, payload: value } as any);
		},
		[dispatch, selectedTool],
	);

	const controlProps = {
		progress,
		selectedTool,
		toolsValues,
		dispatch,
		canvasRef,
		drawFnRef,
		selectedLayer,
		onProgress,
		onChange: handleOnChange,
	};

	return (
		<div className={cn("flex justify-center", className)} {...props}>
			<CropControls
				{...controlProps}
				value={value as ToolValueCropType["defaultValue"]}
			/>
		</div>
	);
}
