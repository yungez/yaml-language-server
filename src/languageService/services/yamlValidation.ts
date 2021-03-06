/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/
'use strict';

import { JSONSchemaService } from './jsonSchemaService';
import { JSONDocument, ObjectASTNode, IProblem, ProblemSeverity } from '../parser/jsonParser';
import { TextDocument, Diagnostic, DiagnosticSeverity } from 'vscode-languageserver-types';
import { PromiseConstructor, Thenable} from '../yamlLanguageService';
import { KubernetesTransformer } from "../kubernetesTransformer";
import { LanguageSettings } from 'vscode-yaml-languageservice/lib/yamlLanguageService';

export class YAMLValidation {
	
	private jsonSchemaService: JSONSchemaService;
	private promise: PromiseConstructor;
	private comments: boolean;
	private validationEnabled: boolean;

	public constructor(jsonSchemaService, promiseConstructor) {
		this.jsonSchemaService = jsonSchemaService;
		this.promise = promiseConstructor;
		this.validationEnabled = true;
	}

	public configure(shouldValidate: LanguageSettings){
		if(shouldValidate){
			this.validationEnabled = shouldValidate.validate;
		}
	}
	
	public doValidation(textDocument, yamlDocument, isKubernetes) {

		if(!this.validationEnabled){
			return this.promise.resolve([]);
		}

		return this.jsonSchemaService.getSchemaForResource(textDocument.uri).then(function (schema) {
			if (schema) {
				
				if(isKubernetes){
                    schema.schema = KubernetesTransformer.doTransformation(schema.schema);
                }
				
				for(let currentYAMLDoc in yamlDocument.documents){
					let currentDoc = yamlDocument.documents[currentYAMLDoc];
					let diagnostics = currentDoc.getValidationProblems(schema.schema);
					for(let diag in diagnostics){
						let curDiagnostic = diagnostics[diag];
						currentDoc.errors.push({ location: { start: curDiagnostic.location.start, end: curDiagnostic.location.end }, message: curDiagnostic.message })
					}
				}
				
				
			}
			var diagnostics = [];
			var added = {};
			for(let currentYAMLDoc in yamlDocument.documents){
				let currentDoc = yamlDocument.documents[currentYAMLDoc];
				currentDoc.errors.concat(currentDoc.warnings).forEach(function (error, idx) {
					// remove duplicated messages
					var signature = error.location.start + ' ' + error.location.end + ' ' + error.message;
					if (!added[signature]) {
						added[signature] = true;
						var range = {
							start: textDocument.positionAt(error.location.start),
							end: textDocument.positionAt(error.location.end)
						};
						diagnostics.push({
							severity: idx >= currentDoc.errors.length ? DiagnosticSeverity.Warning : DiagnosticSeverity.Error,
							range: range,
							message: error.message
						});
					}
				});
			}
			return diagnostics;
		});
	}
}