import { useEffect } from 'react';
import { useRegisterEvents, useSigma, useLoadGraph } from '@react-sigma/core';
import type Graph from 'graphology';
import forceAtlas2 from 'graphology-layout-forceatlas2';
import { BORDER_ACTIVE, BORDER_DEFAULT, BORDER_SEARCH } from './types';

interface ControllerProps {
  graph: Graph;
  hiddenTypes: Set<string>;
  selectedId: string | null;
  focusedNodeId: string | null;
  searchHighlights: Set<string>;
  onNodeClick: (id: string | null, attrs: Record<string, any> | null) => void;
  onEdgeClick: (attrs: Record<string, any> | null) => void;
  setHovered: (label: string | null) => void;
  onRegisterNavigate: (fn: (nodeId: string) => void) => void;
}

/**
 * Controller must live inside a <SigmaContainer> — uses sigma context hooks.
 * Owns: graph load, ForceAtlas2 layout, node visibility, border highlight, events.
 */
export function GraphController({
  graph,
  hiddenTypes,
  selectedId,
  focusedNodeId,
  searchHighlights,
  onNodeClick,
  onEdgeClick,
  setHovered,
  onRegisterNavigate,
}: ControllerProps) {
  const sigma = useSigma();
  const loadGraph = useLoadGraph();
  const registerEvents = useRegisterEvents();

  useEffect(() => {
    onRegisterNavigate((nodeId: string) => {
      const g = sigma.getGraph();
      if (!g.hasNode(nodeId)) return;
      const x = g.getNodeAttribute(nodeId, 'x');
      const y = g.getNodeAttribute(nodeId, 'y');
      if (x != null && y != null) {
        sigma.getCamera().animate({ x, y, ratio: 0.3 }, { duration: 500 });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sigma]);

  useEffect(() => {
    loadGraph(graph);
    if (graph.order === 0) return;
    try {
      forceAtlas2.assign(graph, {
        iterations: 200,
        settings: {
          gravity: 1,
          scalingRatio: 10,
          slowDown: 5,
          barnesHutOptimize: graph.order > 150,
          barnesHutTheta: 0.5,
          adjustSizes: false,
          linLogMode: false,
          outboundAttractionDistribution: false,
        },
      });
    } catch (e) {
      console.warn('FA2:', e);
    }
    graph.forEachNode((nodeId, attrs) => {
      graph.setNodeAttribute(
        nodeId,
        'hidden',
        hiddenTypes.has(attrs.nodeType ?? ''),
      );
    });
    sigma.refresh();
    sigma.getCamera().animatedReset({ duration: 600 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph, loadGraph]);

  useEffect(() => {
    const g = sigma.getGraph();
    if (g.order === 0) return;
    let neighbors: Set<string> | null = null;
    if (focusedNodeId && g.hasNode(focusedNodeId)) {
      neighbors = new Set(g.neighbors(focusedNodeId));
    }
    g.forEachNode((nodeId, attrs) => {
      let hidden = hiddenTypes.has(attrs.nodeType ?? '');
      if (neighbors && nodeId !== focusedNodeId && !neighbors.has(nodeId)) {
        hidden = true;
      }
      g.setNodeAttribute(nodeId, 'hidden', hidden);
    });
    sigma.refresh();
  }, [hiddenTypes, focusedNodeId, sigma]);

  useEffect(() => {
    const g = sigma.getGraph();
    if (g.order === 0) return;
    g.forEachNode((nodeId, attrs) => {
      if (nodeId === selectedId) {
        g.setNodeAttribute(nodeId, 'borderColor', BORDER_ACTIVE);
        g.setNodeAttribute(nodeId, 'borderSize', 0.3);
      } else if (searchHighlights.size > 0 && searchHighlights.has(nodeId)) {
        g.setNodeAttribute(nodeId, 'borderColor', BORDER_SEARCH);
        g.setNodeAttribute(nodeId, 'borderSize', 0.28);
      } else if (attrs.isActiveEntity) {
        g.setNodeAttribute(nodeId, 'borderColor', BORDER_ACTIVE);
        g.setNodeAttribute(nodeId, 'borderSize', 0.25);
      } else {
        g.setNodeAttribute(nodeId, 'borderColor', BORDER_DEFAULT);
        g.setNodeAttribute(nodeId, 'borderSize', 0.15);
      }
    });
    sigma.refresh();
  }, [selectedId, searchHighlights, sigma]);

  useEffect(() => {
    registerEvents({
      clickNode: (e) => {
        const attrs = sigma.getGraph().getNodeAttributes(e.node);
        onNodeClick(e.node, attrs);
      },
      clickEdge: (e) => {
        const attrs = sigma.getGraph().getEdgeAttributes(e.edge);
        onEdgeClick(attrs);
      },
      clickStage: () => {
        onNodeClick(null, null);
        onEdgeClick(null);
      },
      enterNode: (e) => {
        setHovered(
          sigma.getGraph().getNodeAttribute(e.node, 'label') ?? e.node,
        );
        sigma.getCanvases().scene.style.cursor = 'pointer';
      },
      leaveNode: () => {
        setHovered(null);
        sigma.getCanvases().scene.style.cursor = '';
      },
    });
  }, [registerEvents, sigma, onNodeClick, onEdgeClick, setHovered]);

  return null;
}
