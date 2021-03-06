/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import nls = require('vs/nls');
import uri from 'vs/base/common/uri';
import { TPromise, Promise } from 'vs/base/common/winjs.base';
import ee = require('vs/base/common/eventEmitter');
import severity from 'vs/base/common/severity';
import { createDecorator, ServiceIdentifier } from 'vs/platform/instantiation/common/instantiation';
import editor = require('vs/editor/common/editorCommon');
import { Source } from 'vs/workbench/parts/debug/common/debugSource';

export var VIEWLET_ID = 'workbench.view.debug';
export var DEBUG_SERVICE_ID = 'debugService';
export var CONTEXT_IN_DEBUG_MODE = 'inDebugMode';

// Raw

export interface IRawModelUpdate {
	threadId: number;
	thread?: DebugProtocol.Thread;
	callStack?: DebugProtocol.StackFrame[];
	exception?: boolean;
}

// Model

export interface ITreeElement {
	getId(): string;
}

export interface IExpressionContainer extends ITreeElement {
	reference: number;
	getChildren(debugService: IDebugService): TPromise<IExpression[]>;
}

export interface IExpression extends ITreeElement, IExpressionContainer {
	name: string;
	value: string;
}

export interface IThread extends ITreeElement {
	threadId: number;
	name: string;
	callStack: IStackFrame[];
	exception: boolean;
}

export interface IScope extends IExpressionContainer {
	name: string;
	expensive: boolean;
}

export interface IStackFrame extends ITreeElement {
	threadId: number;
	name: string;
	lineNumber: number;
	column: number;
	frameId: number;
	source: Source;
	getScopes(debugService: IDebugService): TPromise<IScope[]>;
}

export interface IEnablement extends ITreeElement {
	enabled: boolean;
}

export interface IBreakpoint extends IEnablement {
	source: Source;
	lineNumber: number;
	desiredLineNumber: number;
	condition: string;
}

export interface IExceptionBreakpoint extends IEnablement {
	name: string;
}

// Events

export var ModelEvents = {
	BREAKPOINTS_UPDATED: 'BreakpointsUpdated',
	CALLSTACK_UPDATED: 'CallStackUpdated',
	WATCH_EXPRESSIONS_UPDATED: 'WatchExpressionsUpdated',
	REPL_ELEMENTS_UPDATED: 'ReplElementsUpdated'
};

export var ViewModelEvents = {
	FOCUSED_STACK_FRAME_UPDATED: 'FocusedStackFrameUpdated',
	SELECTED_EXPRESSION_UPDATED: 'SelectedExpressionUpdated'
};

export var ServiceEvents = {
	STATE_CHANGED: 'StateChanged'
};

export var SessionEvents = {
	INITIALIZED: 'initialized',
	STOPPED: 'stopped',
	DEBUGEE_TERMINATED: 'terminated',
	SERVER_EXIT: 'exit',
	CONTINUED: 'continued',
	THREAD: 'thread',
	OUTPUT: 'output'
};

// Model interfaces

export interface IViewModel extends ee.EventEmitter {
	getFocusedStackFrame(): IStackFrame;
	getSelectedExpression(): IExpression;
	getFocusedThreadId(): number;
	setSelectedExpression(expression: IExpression);
}

export interface IModel extends ee.IEventEmitter, ITreeElement {
	getThreads(): { [reference: number]: IThread; };
	getBreakpoints(): IBreakpoint[];
	areBreakpointsActivated(): boolean;
	getExceptionBreakpoints(): IExceptionBreakpoint[];
	getWatchExpressions(): IExpression[];
	getReplElements(): ITreeElement[];
}

// Service enums

export enum State {
	Disabled,
	Inactive,
	Initializing,
	Stopped,
	Running
}

// Service interfaces

export interface IGlobalConfig {
	version: string;
	debugServer: number;
	configurations: IConfig[];
}

export interface IConfig {
	name: string;
	type: string;
	request: string;
	program: string;
	stopOnEntry: boolean;
	args: string[];
	cwd: string;
	runtimeExecutable: string;
	runtimeArgs: string[];
	env: { [key: string]: string; };
	sourceMaps: boolean;
	outDir: string;
	address: string;
	port: number;
	preLaunchTask: string;
	externalConsole: boolean;
	debugServer: number;
	extensionHostData: any;
}

export interface IRawEnvAdapter {
	type?: string;
	label?: string;
	program?: string;
	args?: string[];
	runtime?: string;
	runtimeArgs?: string[];
}

export interface IRawAdapter extends IRawEnvAdapter {
	enableBreakpointsFor?: { languageIds: string[] };
	configurationAttributes?: any;
	initialConfigurations?: any[];
	win?: IRawEnvAdapter;
	osx?: IRawEnvAdapter;
	linux?: IRawEnvAdapter;
}

export interface IRawDebugSession extends ee.EventEmitter {
	getType(): string;
	disconnect(restart?: boolean): TPromise<DebugProtocol.DisconnectResponse>;

	next(args: DebugProtocol.NextArguments): TPromise<DebugProtocol.NextResponse>;
	stepIn(args: DebugProtocol.StepInArguments): TPromise<DebugProtocol.StepInResponse>;
	stepOut(args: DebugProtocol.StepOutArguments): TPromise<DebugProtocol.StepOutResponse>;
	continue(args: DebugProtocol.ContinueArguments): TPromise<DebugProtocol.ContinueResponse>;
	pause(args: DebugProtocol.PauseArguments): TPromise<DebugProtocol.PauseResponse>;

	scopes(args: DebugProtocol.ScopesArguments): TPromise<DebugProtocol.ScopesResponse>;
	variables(args: DebugProtocol.VariablesArguments): TPromise<DebugProtocol.VariablesResponse>;
	evaluate(args: DebugProtocol.EvaluateArguments): TPromise<DebugProtocol.EvaluateResponse>;
}

export var IDebugService = createDecorator<IDebugService>(DEBUG_SERVICE_ID);

export interface IDebugService extends ee.IEventEmitter {
	serviceId: ServiceIdentifier<any>;
	getState(): State;
	canSetBreakpointsIn(model: editor.IModel, lineNumber: number): boolean;

	getConfiguration(): IConfig;
	setConfiguration(name: string): Promise;
	openConfigFile(sideBySide: boolean): TPromise<boolean>;
	loadLaunchConfig(): TPromise<IGlobalConfig>;

	setFocusedStackFrameAndEvaluate(focusedStackFrame: IStackFrame): void;

	setBreakpointsForModel(modelUri: uri, data: { lineNumber: number; enabled: boolean; condition: string }[]): Promise;
	toggleBreakpoint(modelUri: uri, lineNumber: number, condition?: string): Promise;
	enableOrDisableAllBreakpoints(enabled: boolean): Promise;
	toggleEnablement(element: IEnablement): Promise;
	clearBreakpoints(modelUri?: uri): Promise;
	toggleBreakpointsActivated(): Promise;
	sendAllBreakpoints(): Promise;

	addReplExpression(name: string): Promise;
	clearReplExpressions(): void;

	logToRepl(value: string, severity?: severity): void;
	logToRepl(value: { [key: string]: any }, severity?: severity): void;

	appendReplOutput(value: string, severity?: severity): void;

	addWatchExpression(name?: string): Promise;
	renameWatchExpression(id: string, newName: string): Promise;
	clearWatchExpressions(id?: string): void;

	createSession(): Promise;
	restartSession(): Promise;
	getActiveSession(): IRawDebugSession;

	getModel(): IModel;
	getViewModel(): IViewModel;

	openOrRevealEditor(source: Source, lineNumber: number, preserveFocus: boolean, sideBySide: boolean): Promise;
	revealRepl(inBackground?:boolean): Promise;
}

// Utils

var _formatPIIRegexp = /{([^}]+)}/g;

export function formatPII(value:string, excludePII: boolean, args: {[key: string]: string}): string {
	return value.replace(_formatPIIRegexp, function(match, group) {
		if (excludePII && group.length > 0 && group[0] !== '_') {
			return match;
		}

		return args.hasOwnProperty(group) ?
			args[group] :
			match;
	})
}
