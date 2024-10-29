<?php
/*
Plugin Name: Active Preview
Plugin URI: http://code.google.com/p/wpactivepreview/
Description: This plugin creates a new preview button on the edit page and when pressed the resulting window is active, updating in real-time when you change the post.
Author: Chris Upton
Version: 2.0
Author URI: http://heapdump.wordpress.com
*/

function wrapActivePreviewDiv($content) {
	if(empty($_REQUEST['preview'])) {
		return $content;
	}
	//Wrap the content so we can figure out where the post text is or page text.
	return '<div id="wpactivepreview" class="wpactivepreviewcl">'.$content.'</div>';
}

function activepreviewinit() {
    wp_enqueue_script('activepreview',
    WP_PLUGIN_URL . '/active-preview/active-preview.js',
    array('jquery'));            
}    

function activePreviewReplace ($posts) {
 $previewText = $_REQUEST['activepreviewtext'];
 if(!empty($previewText)){
	$finalText = preg_replace('/\\\"/','"',$previewText);
	$finalText = preg_replace("/\\\'/","'",$finalText);
	$posts[0]->post_content = $finalText;
 }
 return $posts;
}
     
add_action('admin_init', 'activepreviewinit');
add_filter( "the_content", "wrapActivePreviewDiv" ); 
add_filter( "the_posts", "activePreviewReplace" ); 

?>
