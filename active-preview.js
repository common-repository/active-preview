
var autosaveDelayActivePreview = false;

//Special implementation of autosave new callback which calls doActivePreview instead of doPreview.
function activepreview_autosave_saved_new(response) {
	var res = autosave_parse_response(response), tempID, postID;
	// if no errors: update post_ID from the temporary value, grab new save-nonce for that new ID
	if ( res && res.responses.length && !res.errors ) {
		tempID = jQuery('#post_ID').val();
		postID = parseInt( res.responses[0].id, 10 );
		autosave_update_post_ID( postID ); // disabled form buttons are re-enabled here
		if ( tempID < 0 && postID > 0 ) { // update media buttons
			notSaved = false;
			jQuery('#media-buttons a').each(function(){
				this.href = this.href.replace(tempID, postID);
			});
		}
		if ( autosaveDelayActivePreview ) {
			autosaveDelayActivePreview = false;
			doActivePreview();
		}
	} else {
		autosave_enable_buttons(); // re-enable disabled form buttons
	}
}

//This is a new implementation of the autosave which allows for our new activepreview_autosave_saved_new callback to be called.
//It should ONLY be called when the post is NEW. Needs changes to handle other autosave situations.
activepreviewautosave = function() {
	// (bool) is rich editor enabled and active
	var rich = (typeof tinyMCE != "undefined") && tinyMCE.activeEditor && !tinyMCE.activeEditor.isHidden(), post_data, doAutoSave, ed, origStatus, successCallback;
	autosave_disable_buttons();

	post_data = {
		action: "autosave",
		post_ID:  jQuery("#post_ID").val() || 0,
		post_title: jQuery("#title").val() || "",
		autosavenonce: jQuery('#autosavenonce').val(),
		post_type: jQuery('#post_type').val() || "",
		autosave: 1
	};

	jQuery('.tags-input').each( function() {
		post_data[this.name] = this.value;
	} );

	// We always send the ajax request in order to keep the post lock fresh.
	// This (bool) tells whether or not to write the post to the DB during the ajax request.
	doAutoSave = true;

	// No autosave while thickbox is open (media buttons)
	if ( jQuery("#TB_window").css('display') == 'block' )
		doAutoSave = false;

	/* Gotta do this up here so we can check the length when tinyMCE is in use */
	if ( rich && doAutoSave ) {
		ed = tinyMCE.activeEditor;
		// Don't run while the TinyMCE spellcheck is on. It resets all found words.
		if ( ed.plugins.spellchecker && ed.plugins.spellchecker.active ) {
			doAutoSave = false;
		} else {
			if ( 'mce_fullscreen' == ed.id )
				tinyMCE.get('content').setContent(ed.getContent({format : 'raw'}), {format : 'raw'});
			tinyMCE.get('content').save();
		}
	}

	post_data["content"] = jQuery("#content").val();
	if ( jQuery('#post_name').val() )
		post_data["post_name"] = jQuery('#post_name').val();

	// Nothing to save or no change.
	if ( ( post_data["post_title"].length == 0 && post_data["content"].length == 0 ) || post_data["post_title"] + post_data["content"] == autosaveLast ) {
		doAutoSave = false;
	}

	origStatus = jQuery('#original_post_status').val();

	goodcats = ([]);
	jQuery("[name='post_category[]']:checked").each( function(i) {
		goodcats.push(this.value);
	} );
	post_data["catslist"] = goodcats.join(",");

	if ( jQuery("#comment_status").attr("checked") )
		post_data["comment_status"] = 'open';
	if ( jQuery("#ping_status").attr("checked") )
		post_data["ping_status"] = 'open';
	if ( jQuery("#excerpt").size() )
		post_data["excerpt"] = jQuery("#excerpt").val();
	if ( jQuery("#post_author").size() )
		post_data["post_author"] = jQuery("#post_author").val();
	post_data["user_ID"] = jQuery("#user-id").val();

	if ( doAutoSave ) {
		autosaveLast = jQuery("#title").val()+jQuery("#content").val();
	} else {
		post_data['autosave'] = 0;
	}

	if ( parseInt(post_data["post_ID"], 10) < 1 ) {
		post_data["temp_ID"] = post_data["post_ID"];
	} 
	successCallback = activepreview_autosave_saved_new; // new post

	autosaveOldMessage = jQuery('#autosave').html();

	jQuery.ajax({
		data: post_data,
		beforeSend: doAutoSave ? autosave_loading : null,
		type: "POST",
		url: autosaveL10n.requestFile,
		success: successCallback
	});
}

//This object keeps track of state for the childwindow created for active preview and updating it.
var jcommunicator = {
	changecount : 0,
	childwindow : null,
	populatechange : function (ed , l ) {
		var jcommunicator = jQuery(this.childwindow.document);
		var elementpostcontainer = this.getpostelement(jcommunicator);
		elementpostcontainer.html(ed.getBody().innerHTML);
		//Check in a second and a half to see if the user kept typing if not then do an ajax call.
		this.changecount++;
		window.setTimeout("jcommunicator.asyncCheckForChange("+this.changecount+");",1500);
	},
	populatehtmlchange : function (html) {
		var jcommunicator = jQuery(this.childwindow.document);
		var elementpostcontainer = this.getpostelement(jcommunicator);

		//Attempt to set whitespace in a similar way that wordpress does on the backend so the difference of the backend call and this isn't that much.
		//An empty line = line with only white space
		//First replace all one or more empty lines with one br.
		var regex = /^\s*$/gm;
		var updatedhtml = html.replace(regex,"~%activepreview%~");
		//Replace any line break at any line that is no 
		//line ending with a br
		regex = /^\s*((<((span)|(a)|(b)|(i)|(sup)|(u)|(s)|(em)|(label)|(sub)|(strong)|(strike)).*)|((^<^\/)&(^~^%).*)|(\w.*))$/gmi;
		updatedhtml = updatedhtml.replace(regex,"$1<br/>\n");
		//Remove the active preview place holders now to avoid double spacing.
		regex = /(~%activepreview%~)+/g;
		updatedhtml = updatedhtml.replace(regex,"<br/>");
		elementpostcontainer.html(updatedhtml);
		//Check in a second and a half to see if the user kept typing if not then do an ajax call.
		this.changecount++;
		window.setTimeout("jcommunicator.asyncCheckForChange("+this.changecount+");",1500);

	},
	getpostelement : function (jcommunicator) {
		//This div is actually always found because we wrap it with a filter in PHP.
		return jcommunicator.find('#wpactivepreview');
	},
	asyncCheckForChange : function(lastseencount) {
		//If lastseencount wasn't equal to changecount that means there is another change coming which we should wait for to do the update on.
		if(lastseencount == this.changecount) {
			var jcommunicator = jQuery(this.childwindow.document);
			var elementpostcontainer = this.getpostelement(jcommunicator);
			elementpostcontainer.load(this.childwindow.location.href+' .wpactivepreviewcl',{activepreviewtext: elementpostcontainer.html()});
		} 
	}
};

//Preforms the active preview popup.
function doActivePreview() {
	//Don't allow this functionality in IE. It just doesn't work well there.
	if(jQuery.browser.msie){
		//For now do an old school alert.
		alert("Active Preview does not support IE browsers, to use functionality please use with another browser");
	} else {
		jcommunicator.childwindow = window.open('','activepreview','menubar=yes,scrollbars=yes,copyhistory=yes,resizable=yes');
		jQuery('input#wp-preview').val('dopreview');
		jQuery('form#post').attr('target', 'activepreview').submit().attr('target', '');
		jQuery('input#wp-preview').val('');
	
		var htmltext = jQuery('#content');
		var html = null;
		htmltext.keyup(function(e) {
			code = e.keyCode ? e.keyCode : e.which;
			//Ignore on directional key presses.
			if(code.toString() != 37 && code.toString() != 38 && code.toString() != 39 && code.toString() != 40) {
		       		jcommunicator.populatehtmlchange(this.value);
			}
		});

		if(tinyMCE.activeEditor){
			if(!window.tinyalreadyinit){
				//Hook a listener onto the iframe for changes and send the changes to the content div for the post which wordpress puts into the page.
				//We need to hook into onKeyUp to catch key strokes.
				tinyMCE.activeEditor.onKeyUp.add(function (ed, l) {
					jcommunicator.populatechange(ed,l);
				}); 
				//We need to hook into onNodeChange to get changes that aren't necessarily related to key strokes (like changing text color etc)
				tinyMCE.activeEditor.onNodeChange.add(function (ed, l) {
					jcommunicator.populatechange(ed,l);
				}); 
				window.tinyalreadyinit = true;
			}
		}
	}
}


jQuery(document).ready(function () {
//Insert the new preview link.
//id for the preview action div is - preview-action
var previewdiv = jQuery('#preview-action');
//Only do preview logic if you have a valid preview link.
if(previewdiv && previewdiv.length != 0) {
//Figure out the what the preview button text is for internationalization this text could vary.
var previewbutton = jQuery('#post-preview');
var previewbuttontext = previewbutton.html();
var additionalbuttonhtml = previewdiv.html().replace("post-preview","post-preview2");
//Chop out any text no associated with the anchor tag.
additionalbuttonhtml = additionalbuttonhtml.substring(additionalbuttonhtml.toLowerCase().indexOf('<a'),additionalbuttonhtml.toLowerCase().indexOf('</a>')+4);
additionalbuttonhtml = additionalbuttonhtml.replace(previewbuttontext,"Active Preview");
var actiondiv = jQuery('#minor-publishing-actions');
actiondiv.append("<div style='margin-top: 3px; float: right;'>"+additionalbuttonhtml+"</div>");
//Because tinyMCE doesn't get initialized all the way when they have the 
//html editor selected on first page visit. SO lets just hook into the
// visual link on the page and initialize if nothing was initialized yet.
var previeweditorlink = jQuery('#edButtonPreview');
previeweditorlink.click(function (e) {
		switchEditors.go('content', 'tinymce');
		if(!window.tinyalreadyinit){
			//Hook a listener onto the iframe for changes and send the changes to the content div for the post which wordpress puts into the page.
			//We need to hook into onKeyUp to catch key strokes.
			tinyMCE.activeEditor.onKeyUp.add(function (ed, l) {
				jcommunicator.populatechange(ed,l);
			}); 
			//We need to hook into onNodeChange to get changes that aren't necessarily related to key strokes (like changing text color etc)
			tinyMCE.activeEditor.onNodeChange.add(function (ed, l) {
			    jcommunicator.populatechange(ed,l);
			}); 
			window.tinyalreadyinit = true;
		}
});

//Hook in the onclick to do an open but keep a reference to the window that was opened for update.
var activelink = jQuery('#post-preview2');

//Add the active preview onclick behavior.
activelink.click(function (e) {
	e.preventDefault();
	if ( 1 > jQuery('#post_ID').val() && notSaved ) {
		autosaveDelayActivePreview = true;
		activepreviewautosave();
		return false;
	}
	doActivePreview();
	return false;
});
}
});
