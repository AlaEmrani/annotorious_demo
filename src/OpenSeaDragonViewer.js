import OpenSeadragon, { parseJSON } from "openseadragon";
import * as Annotorious from '@recogito/annotorious-openseadragon';
import '@recogito/annotorious-openseadragon/dist/annotorious.min.css';
import * as SelectorPack from "@recogito/annotorious-selector-pack";
import {ColorSelectorWidget, ColorFormatter} from "./ManualEditor";
import * as svgOverlay from "./openseadragon-svg-overlay"
import * as d3 from "d3"


import React, { useEffect, useState } from "react";

const OpenSeaDragonViewer = ({ image }) => {
  const [viewer, setViewer] = useState( null);
  const [anno, setAnno] = useState(null)
  
useEffect(() => {
    if (image && viewer) {
      viewer.open(image.source);
    }
    if (image && anno){
        InitAnnotations()
    }
  }, [image]);

let center = function (arr)
{
    var x = arr.map (xy => xy[0]);
    var y = arr.map (xy => xy[1]);
    var cx = (Math.min (...x) + Math.max (...x)) / 2;
    var cy = (Math.min (...y) + Math.max (...y)) / 2;
    return [cx, cy];
}

let calcPolygonArea = (vertices) =>{
    let total = 0;
    for (let i = 0, l = vertices.length; i < l; i++) {
        let addX = parseFloat(vertices[i][0]);
        let addY = vertices[i == vertices.length - 1 ? 0 : i + 1][1];
        let subX = vertices[i == vertices.length - 1 ? 0 : i + 1][0];
        let subY = parseFloat(vertices[i][1]);

        total += (addX * addY * 0.5);
        total -= (subX * subY * 0.5);
    }
    return Math.abs(total);
}

let getAnnotationShape = (annotation) =>{
    let annotationShape;
    const annotationTargetValue = annotation.target.selector['value'].split(' ')[0];
    if (annotation.target.selector['type'] == "FragmentSelector"){
        annotationShape = "rect";
    } else if(annotationTargetValue.includes("polygon")){
        annotationShape = "polygon";
    } else if(annotationTargetValue.includes("circle")){
        annotationShape = "circle";
    } else {
        annotationShape = "pin";
    }
    return annotationShape;
}

let getAnnotationCenter = (annotation) =>{
    const annotationShape = getAnnotationShape(annotation);
    let cx, cy;
    if (annotationShape == 'rect'){
        const annotationValues = annotation.target.selector['value'].split(',');
        const x = parseFloat(annotationValues[0].split(':')[1]);
        const [y, w, h] = [1, 2, 3].map(i => parseFloat(annotation.target.selector['value'].split(',')[i]));
        [cx, cy] = [x + w/2, y + h/2];
    } else if(annotationShape == 'polygon'){
        const pointsCoordinates = annotation.target.selector['value'].split('"')[1]
            .split(' ').map(x => x.split(','));
        [cx, cy] = center(pointsCoordinates);
    } else if(annotationShape == 'circle'){
        [cx, cy] = [1, 3].map(i => parseFloat(annotation.target.selector['value'].split('"')[i]));
    }else {
        throw new Error("Annotation shape is not defined");
    }
    return [cx, cy];
}

let getAnnotationArea = (annotation) =>{
    const annotationShape = getAnnotationShape(annotation);
    let annotationArea;
    if (annotationShape == 'rect'){
        let [x, y] = [2, 3].map(i => parseFloat(annotation.target.selector['value'].split(',')[i]));
        annotationArea = x*y;
    } else if(annotationShape == 'polygon'){
        const pointsCoordinates = annotation.target.selector['value'].split('"')[1]
            .split(' ').map(x => x.split(','));
        annotationArea = calcPolygonArea(pointsCoordinates);
    } else if(annotationShape == 'circle'){
        const radius = parseFloat(annotation.target.selector['value'].split('"')[5]);
        annotationArea = Math.PI*(radius**2);
    }else {
        throw new Error("Annotation shape is not defined");
    }
        return annotationArea;
    }

const InitOpenseadragon = () => {
    viewer && viewer.destroy();
    let startPoint, endPoint, firstScale;
    let drag = false;
    let showAnnotationArea = false;
    let currentAnnotationArea = 0;
    
    const initViewer = OpenSeadragon({
        id: "openSeaDragon",
        prefixUrl: "openseadragon-images/",
        animationTime: 0.5,
        blendTime: 0.1,
        constrainDuringPan: true,
        maxZoomPixelRatio: 2,
        minZoomLevel: 1,
        visibilityRatio: 1,
        zoomPerScroll: 2,
        gestureSettingsMouse: {clickToZoom: false, dblClickToZoom: true},
    })
    let overlay = initViewer.svgOverlay();

    initViewer.addHandler('zoom', () =>{
        drag = false;
        d3.selectAll('line').remove();
        d3.selectAll('rect.infoRect').remove();
        d3.selectAll('text').remove();
        d3.selectAll("rect.boundingBox").remove();
    })

    initViewer.addHandler('open', () =>{
        firstScale = currentScale();
    })

    let currentScale = () => {
        const containerWidth = initViewer.viewport.getContainerSize().x;
        const zoom = initViewer.viewport.getZoom(true);
        return zoom * containerWidth / initViewer.world.getContentFactor();
    }

    // initViewer.addHandler('canvas-press', (event) => {
    //     drag = !drag;
    //     startPoint = initViewer.viewport.pointFromPixel(event.position);
    //     console.log('press', startPoint, event.position,  drag);
    //     if (!drag){
    //         d3.selectAll('line').remove();
    //         d3.selectAll('rect.infoRect').remove();
    //         d3.selectAll('text').remove();
    //     }
    // });
    //
    // new OpenSeadragon.MouseTracker({
    //     element: initViewer.container,
    //     moveHandler: (event) => {
    //         const strk_width = (firstScale*.005)/currentScale();
    //         const fontSize = (firstScale*.015)/currentScale();
    //         endPoint = initViewer.viewport.pointFromPixel(event.position);
    //         if (showAnnotationArea){
    //             d3.selectAll('#boundingBox').remove();
    //             d3.selectAll('#annotationArea').remove();
    //             const t = d3.select(overlay.node()).append('text')
    //                 .attr('x', endPoint.x)
    //                 .attr('y', endPoint.y)
    //                 .attr('fill', 'black')
    //                 .style("font-size", fontSize)
    //                 .attr("id", "annotationArea")
    //                 .attr("text-anchor", "middle")
    //                 .text(currentAnnotationArea);
    //             const boundingBox = t.node().getBBox();
    //             d3.select(overlay.node()).append("rect")
    //                 .style('fill', '#ffcc66')
    //                 .attr("x", boundingBox.x)
    //                 .attr("width", boundingBox.width)
    //                 .attr("y", boundingBox.y)
    //                 .attr("id", "boundingBox")
    //                 .style("opacity", 0.2)
    //                 .attr("height", boundingBox.height);
    //         }
    //
    //         if (drag) {
    //             const rect_size = strk_width * 10
    //             const middlePoint = {'x': (startPoint.x + endPoint.x)/2,
    //                                   'y': (startPoint.y + endPoint.y)/2}
    //             const perpendicularSlope = -(endPoint.x - startPoint.x)/(endPoint.y - startPoint.y)
    //             const rectInfoDist = {'x': strk_width, 'y': strk_width*perpendicularSlope}
    //             const lineLength = Math.round(100*Math.sqrt((endPoint.x - startPoint.x)**2 +
    //                 (endPoint.y - startPoint.y)**2)) /100
    //
    //             d3.selectAll('line').remove();
    //             d3.selectAll('rect.infoRect').remove();
    //             d3.selectAll('text').remove();
    //             let ruler = d3.select(overlay.node()).append("line")
    //                     .attr('x1', endPoint.x)
    //                     .attr('y1', endPoint.y)
    //                     .attr('x2', startPoint.x)
    //                     .attr('y2', startPoint.y)
    //                     .attr('stroke', 'red')
    //                     .attr('stroke-width', strk_width.toString());
    //
    //             d3.select(overlay.node()).append('text')
    //                 .attr('x', middlePoint.x + rectInfoDist.x)
    //                 .attr('y', middlePoint.y  + (rectInfoDist.y - .1)*rect_size)
    //                 .attr('fill', 'black')
    //                 .style("font-size", fontSize)
    //                 .text(lineLength.toString());
    //
    //
    //         }
    //     },
    //
    // });


    setViewer(initViewer);
    const config = {
        widgets: [
            ColorSelectorWidget,
            'COMMENT',
            'TAG'
        ],
        formatter: ColorFormatter,
    };
    let annotate = Annotorious(initViewer, {});
    annotate.on('mouseEnterAnnotation', function(annotation, event) {
        console.log(annotation);
        showAnnotationArea = true;
        currentAnnotationArea = Math.round(getAnnotationArea(annotation));
    });

    annotate.on('mouseLeaveAnnotation', function(annotation, event) {
        showAnnotationArea = false;
        d3.selectAll('text').remove();
        d3.selectAll('#boundingBox').remove();
    });

    annotate.on('createAnnotation', (annotation) => {
        console.log(annotation.id.concat('new'));
        annotation['id'] = annotation.id.concat('new')

    });

    SelectorPack(annotate, {});
    annotate.setDrawingTool('polygon');
    console.log(annotate.listDrawingTools());
    setAnno(annotate)
  };

  const [annotations, setAnnotations] = useState([])

const InitAnnotations = async() => {

    const storedAnnoatations = getLocalAnnotations
    if (storedAnnoatations) {
        const annotations = parseJSON(storedAnnoatations)
        setAnnotations(annotations)
        anno.setAnnotations(annotations);

    }

    anno.on('createAnnotation', (annotation) => {
        const newAnnotations = [...annotations, annotation]
        setAnnotations(newAnnotations)
        setLocalAnnotation(newAnnotations)
        viewer.gestureSettingsMouse = {clickToZoom: false, dblClickToZoom: true};

    });

    anno.on('updateAnnotation', (annotation, previous) => {
        const newAnnotations = annotations.map(val => {
            if (val.id === annotation.id) return annotation
            return val
        })
        setAnnotations(newAnnotations)
        setLocalAnnotation(newAnnotations)
    });

    anno.on('deleteAnnotation', (annotation) => {
        const newAnnotations  = annotations.filter(val => val.id !== annotation.id)
        setAnnotations(newAnnotations)
        setLocalAnnotation(newAnnotations)
    });


}

const getLocalAnnotations =  () => {
    return localStorage.getItem(image.source.Image.Url) 
}

const setLocalAnnotation = (newAnnotations) => {
    localStorage.setItem(image.source.Image.Url, JSON.stringify(newAnnotations)) 
}

useEffect(() => {
    InitOpenseadragon();
    return () => {
        viewer && viewer.destroy();
    };
  }, []);
return (
  <div 
  id="openSeaDragon" 
  style={{
    height: "800px",
    width: "1200px"
  }}
  >
  </div>
  );
};
export { OpenSeaDragonViewer };